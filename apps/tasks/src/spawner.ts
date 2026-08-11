import { setTimeout as delay } from "node:timers/promises";
import type { PeriodicTaskName } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import {
	createPeriodicTask,
	type PeriodicSpawnOutcome,
} from "@virtool/data/tasks/data";
import type { Logger } from "@virtool/logger";
import {
	PERIODIC_TASKS,
	type PeriodicTaskRegistration,
	SPAWN_TICK_INTERVAL_MS,
} from "./tasks/periodic";

/** The spawner surface the app wires into its lifecycle. */
export type TaskSpawner = {
	/** Begin ticking. Calling it again does nothing. */
	start: () => void;
	/**
	 * Stop ticking and let the tick in flight finish.
	 *
	 * There is nothing to drain — the spawner holds no work, only a transaction
	 * that is a lock, a read and an insert. Idempotent, and it never rejects.
	 */
	stop: () => Promise<void>;
	/** When the loop last completed a tick, or `null` before the first one. */
	getLastTickAt: () => Date | null;
};

/** What {@link createTaskSpawner} needs. */
export type TaskSpawnerOptions = {
	db: Db;
	logger: Logger;
	/**
	 * Record a spawn attempt, for `virtool_task_spawn_total`.
	 *
	 * Required rather than optional: a seam that can be forgotten is one whose
	 * series go quiet with nothing failing to say so.
	 */
	recordSpawn: (type: PeriodicTaskName, outcome: PeriodicSpawnOutcome) => void;
	/** Defaults to {@link PERIODIC_TASKS}. */
	schedule?: PeriodicTaskRegistration[];
	/** Defaults to {@link SPAWN_TICK_INTERVAL_MS}. */
	tickIntervalMs?: number;
};

/**
 * Reject a schedule the tick cannot honour.
 *
 * Python raises `ValueError` on a non-positive interval inside
 * `create_periodic`, which is per call; this checks once, at construction, so a
 * bad schedule fails the process at startup rather than every thirty seconds
 * forever. An interval of zero would leave the suppression window permanently
 * open and spawn the task on every tick.
 */
function checkSchedule(schedule: PeriodicTaskRegistration[]): void {
	for (const { type, intervalSeconds } of schedule) {
		if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
			throw new Error(
				`the interval for periodic task "${type}" must be a positive number of seconds, got ${intervalSeconds}`,
			);
		}
	}
}

/**
 * Build the loop that spawns Virtool's periodic tasks.
 *
 * **This runs in production beside Python's spawner**, not instead of it. Both
 * insert the same five types into the same table and are mutually excluded only
 * by the advisory lock `createPeriodicTask` takes, so the loop's job is to walk
 * the schedule on Python's cadence and stay out of the way of the exclusion.
 *
 * It inserts and nothing else — it never claims, updates or completes a task.
 * That is the runner's half of this process.
 *
 * It reads no configuration, opens no pool and installs no signal handler. All
 * three are the app's, which calls `stop()` from a shutdown hook.
 */
export function createTaskSpawner(options: TaskSpawnerOptions): TaskSpawner {
	const { db, logger, recordSpawn } = options;

	const schedule = options.schedule ?? PERIODIC_TASKS;
	const tickIntervalMs = options.tickIntervalMs ?? SPAWN_TICK_INTERVAL_MS;

	checkSchedule(schedule);

	/** Aborted by `stop()`. Ends the loop and wakes its tick wait. */
	const stopping = new AbortController();

	let lastTickAt: Date | null = null;
	let loop: Promise<void> | undefined;
	let stopped: Promise<void> | undefined;

	async function spawn(registration: PeriodicTaskRegistration): Promise<void> {
		const { type, intervalSeconds } = registration;

		const result = await createPeriodicTask(db, type, intervalSeconds);

		recordSpawn(type, result.outcome);

		if (result.outcome === "spawned") {
			logger.info({ task_id: result.task.id, type }, "spawned a periodic task");

			return;
		}

		logger.debug(
			{ interval_seconds: intervalSeconds, outcome: result.outcome, type },
			"did not spawn a periodic task",
		);
	}

	/**
	 * Consider every registered task once, in registration order.
	 *
	 * A failure on one type must not cost the rest of the tick: the types are
	 * independent, and a `sweep_blast` that cannot be inserted is no reason for
	 * `refresh_hmms` to go unconsidered for another thirty seconds.
	 */
	async function tick(): Promise<void> {
		for (const registration of schedule) {
			if (stopping.signal.aborted) {
				return;
			}

			try {
				await spawn(registration);
			} catch (err) {
				logger.error(
					{ err, type: registration.type },
					"failed to spawn a periodic task",
				);
			}
		}
	}

	async function run(): Promise<void> {
		while (!stopping.signal.aborted) {
			await tick();

			lastTickAt = new Date();

			if (stopping.signal.aborted) {
				break;
			}

			try {
				await delay(tickIntervalMs, undefined, { signal: stopping.signal });
			} catch {
				// `stop()` aborted the wait; the loop condition ends it.
			}
		}
	}

	return {
		start() {
			if (loop !== undefined) {
				return;
			}

			logger.info(
				{
					tick_interval_ms: tickIntervalMs,
					tasks: schedule.map(({ type, intervalSeconds }) => ({
						type,
						interval_seconds: intervalSeconds,
					})),
				},
				"task spawner started",
			);

			loop = run();
		},

		stop() {
			if (stopped !== undefined) {
				return stopped;
			}

			stopping.abort();

			stopped = (loop ?? Promise.resolve()).then(
				() => {
					logger.info("task spawner stopped");
				},
				(err) => {
					// `run` catches per-task failures itself, so this is the genuinely
					// unexpected — and the only move left to a caller winding the
					// process down is to carry on winding it down.
					logger.error({ err }, "the task spawn loop failed");
				},
			);

			return stopped;
		},

		getLastTickAt: () => lastTickAt,
	};
}
