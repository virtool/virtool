import { setTimeout as delay } from "node:timers/promises";
import type { Db } from "@virtool/data/db/pg";
import {
	acquireTask,
	buildRunnerId,
	type ClaimedTask,
	failTask,
	releaseRunnerClaims,
	releaseTask,
	renewLeases,
	TASK_HEARTBEAT_SECONDS,
} from "@virtool/data/tasks/data";
import type { Logger } from "@virtool/logger";
import type { TaskRegistry } from "./framework/define";
import { runTask, type TaskOutcome } from "./framework/run";
import type { RunOutcome, TaskRunSample } from "./metrics/registry";

/**
 * How long the claim loop waits between polls.
 *
 * Python's interval, kept as it is. A LISTEN/NOTIFY wakeup would cut the latency
 * between a task being spawned and picked up, but it is an optimisation over a
 * claim path that has to be correct on polling alone first.
 */
export const POLL_INTERVAL_MS = 2_000;

/**
 * How late a heartbeat may run before it is reported.
 *
 * The hazard this watches for is event-loop starvation: a synchronous block
 * longer than `TASK_LEASE_SECONDS` starves the renewal, the lease expires, and
 * another runner claims a task that is still running — Kleppmann's
 * garbage-collection pause in Node form. Task work is overwhelmingly I/O-bound,
 * so this is a tripwire rather than an expected condition, and it is what would
 * justify moving the heartbeat onto a worker thread. That move buys a second
 * Postgres connection per replica and a duplicated database handle inside the
 * worker, so it waits on a measurement rather than on theory.
 */
const HEARTBEAT_LAG_WARN_MS = 5_000;

/**
 * How much of the drain window is held back for the release.
 *
 * The whole window is the ceiling the shutdown hook declares, so a drain that
 * spent all of it waiting would be abandoned mid-`UPDATE` and leave the claims
 * it was handing back exactly where a hard kill would have.
 */
const RELEASE_RESERVE_MS = 2_000;

/**
 * How long an aborted task is given to unwind before its claim is released
 * anyway.
 *
 * **Releasing before it settles skips its `cleanup`.** `runTask` renews the
 * lease to confirm it still holds the task before tearing anything down, and a
 * release has already cleared `runner_id` — so the renewal matches nothing, the
 * run reports `fenced`, and the cleanup that should have run on the abort path
 * is silently skipped. Waiting is what keeps the claim alive long enough for the
 * body to answer that question truthfully.
 *
 * A cooperative body unwinds in milliseconds, so this is spent only on one that
 * ignores its signal — and for that one the release below is the right backstop.
 */
const ABORT_GRACE_MS = 3_000;

/** The runner surface the app wires into its lifecycle. */
export type TaskRunner = {
	/** Begin claiming. Calling it again does nothing. */
	start: () => void;
	/**
	 * Stop claiming, drain, release what is left.
	 *
	 * Idempotent — a second call returns the first one's promise rather than
	 * draining again — and it never rejects. A failure in the release path is
	 * logged, because the only move left to a caller winding the process down is
	 * to carry on winding it down.
	 */
	stop: () => Promise<void>;
	/**
	 * When the claim loop last completed a poll, or `null` before the first one.
	 *
	 * The seam a liveness check would be built on. Nothing reads it today:
	 * `GET /health/live` is deliberately static, because a liveness probe that
	 * can fail restarts the fleet and kills every task in flight.
	 */
	getLastTickAt: () => Date | null;
};

/** What {@link createTaskRunner} needs. */
export type TaskRunnerOptions<C> = {
	db: Db;
	logger: Logger;
	/** The task types this runner will claim, keyed by their `type` column value. */
	registry: TaskRegistry<C>;
	/** Injected into every handler as `ctx`. */
	ctx: C;
	/**
	 * Milliseconds `stop()` may take in total, matching the ceiling the shutdown
	 * hook declares. Part of it is reserved for the release.
	 */
	drainTimeoutMs: number;
	/**
	 * Record a run that reached a terminal state, for `virtool_task_runs_total`
	 * and `virtool_task_duration_seconds`.
	 *
	 * Required rather than optional: a seam that can be forgotten is one whose
	 * series go quiet with nothing failing to say so.
	 */
	recordRun: (sample: TaskRunSample) => void;
	/** Defaults to `buildRunnerId()`. */
	runnerId?: string;
	/** Defaults to {@link POLL_INTERVAL_MS}. */
	pollIntervalMs?: number;
	/** Defaults to `TASK_HEARTBEAT_SECONDS`. */
	heartbeatIntervalMs?: number;
	/** Defaults to {@link ABORT_GRACE_MS}. */
	abortGraceMs?: number;
	/** Overrides the progress debounce window. For tests. */
	debounceMs?: number;
};

/** What {@link dispatchTask} needs to run one claimed task. */
export type DispatchTaskOptions<C> = {
	db: Db;
	logger: Logger;
	registry: TaskRegistry<C>;
	ctx: C;
	task: ClaimedTask;
	signal: AbortSignal;
	debounceMs?: number;
};

/** Whether `promise` settled inside `ms`. Never rejects. */
function settles(promise: Promise<void>, ms: number): Promise<boolean> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(false), ms);

		// The deadline must not be what holds the process open once the drain is
		// over.
		timer.unref();

		promise.then(
			() => {
				clearTimeout(timer);
				resolve(true);
			},
			() => {
				clearTimeout(timer);
				resolve(true);
			},
		);
	});
}

/**
 * Run a claimed task through its registered handler, or fail it for having none.
 *
 * **A type with no handler is failed, never released.** Python acquires the row,
 * finds no class for the name, logs and returns — leaving `acquired_at` set,
 * `complete = false` and `error = NULL`. That row is invisible to every
 * consumer, counted as running forever, and drawn as a progress bar that never
 * moves; it is the documented cause of the task runner's abandoned KEDA trigger.
 * Releasing instead is no better: an unknown row is claimable by construction,
 * so it comes straight back on the next poll and hot-loops without ever
 * surfacing anything. Failing it is the only outcome a user can see.
 *
 * The claim already filters on the registry's keys, so this branch should be
 * unreachable — which is exactly why it is a branch. The alternative is assuming
 * the claim can only ever return a type this process knows, and that assumption
 * is what the stranded rows were made of.
 *
 * Separate from the runner so a test can hand it a real claim of a type nothing
 * is registered for, which the claim query will not produce.
 */
export async function dispatchTask<C>(
	options: DispatchTaskOptions<C>,
): Promise<TaskOutcome> {
	const { ctx, db, logger, registry, signal, task } = options;

	const def = registry[task.type];

	if (def === undefined) {
		const message = `no handler registered for task type "${task.type}"`;

		logger.error({ task_id: task.id, type: task.type }, message);

		try {
			// Through `failTask`, not a write of its own: it sets `complete` beside
			// `error`, and it is where the `tasks` frame that tells the UI comes
			// from. A hand-rolled update here would strand the row again, silently.
			if (!(await failTask(db, task.id, task.runnerId, message))) {
				return { status: "fenced" };
			}
		} catch (err) {
			logger.error(
				{ err, task_id: task.id },
				"failed to fail a task with no handler",
			);

			return { status: "aborted" };
		}

		return { status: "failed", error: message };
	}

	return runTask({
		ctx,
		db,
		def,
		logger,
		signal,
		task,
		...(options.debounceMs !== undefined && { debounceMs: options.debounceMs }),
	});
}

/**
 * Build the loop that claims tasks, runs them, and holds their leases.
 *
 * **One task at a time**, matching Python. Replica count is the scaling lever
 * and it already exists, and the bodies are heavy enough — a reference import
 * parses tens of megabytes of JSON, an HMM install decompresses a
 * multi-hundred-megabyte tarball — that in-process concurrency would multiply
 * peak memory against a pod limit rather than fill idle time.
 *
 * The seams for many are built anyway: the in-flight tasks are a collection
 * rather than a nullable single, and `renewLeases` renews a set. Raising the cap
 * is meant to be a change to this file, not a redesign of it.
 *
 * It reads no configuration, opens no pool, installs no signal handler and binds
 * no listener. All four are the app's, which calls `stop()` from a shutdown hook.
 */
export function createTaskRunner<C>(options: TaskRunnerOptions<C>): TaskRunner {
	const { ctx, db, logger, registry } = options;

	const runnerId = options.runnerId ?? buildRunnerId();
	const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
	const heartbeatIntervalMs =
		options.heartbeatIntervalMs ?? TASK_HEARTBEAT_SECONDS * 1_000;

	/**
	 * The tasks this runner holds, and the signal that stops each.
	 *
	 * A map rather than a single slot even though the cap is one, so the
	 * heartbeat, the drain and the release are already written against a set.
	 */
	const inFlight = new Map<number, AbortController>();

	/** Aborted by `stop()`. Ends the claim loop and wakes its poll wait. */
	const stopping = new AbortController();

	let lastTickAt: Date | null = null;
	let loop: Promise<void> | undefined;
	let heartbeat: NodeJS.Timeout | undefined;
	let stopped: Promise<void> | undefined;
	let beating = false;

	async function release(task: ClaimedTask): Promise<void> {
		try {
			await releaseTask(db, task.id, task.runnerId);
		} catch (err) {
			logger.error(
				{ err, task_id: task.id },
				"failed to release a claimed task",
			);
		}
	}

	/**
	 * Renew every lease this runner holds, and abandon what it turns out not to.
	 *
	 * `renewLeases` reports the ids it renewed rather than throwing, because a
	 * partial result is the normal outcome: a task whose lease expired and was
	 * reclaimed no longer carries this runner's id, so it is simply absent. The
	 * difference is what has been fenced, and aborting its signal is how the body
	 * learns to stop working on something another runner now owns.
	 */
	async function beat(): Promise<void> {
		// A renewal slower than the interval would otherwise have a second beat
		// firing on top of it, asking the same question and landing its `UPDATE`
		// out of order behind the first.
		if (beating) {
			return;
		}

		beating = true;

		try {
			const ids = [...inFlight.keys()];

			if (ids.length === 0) {
				return;
			}

			const renewed = await renewLeases(db, ids, runnerId);

			for (const id of ids) {
				if (renewed.includes(id)) {
					continue;
				}

				logger.warn(
					{ task_id: id },
					"abandoning a task whose lease this runner no longer holds",
				);

				inFlight.get(id)?.abort();
			}
		} catch (err) {
			// Never fatal to the running task. Four beats of headroom exist precisely
			// so a single blip is survivable, and the next beat retries.
			logger.warn({ err }, "failed to renew task leases");
		} finally {
			beating = false;
		}
	}

	function startHeartbeat(): void {
		let expectedAt = performance.now() + heartbeatIntervalMs;

		heartbeat = setInterval(() => {
			const firedAt = performance.now();
			const lag = firedAt - expectedAt;

			expectedAt = firedAt + heartbeatIntervalMs;

			if (lag > HEARTBEAT_LAG_WARN_MS) {
				logger.warn(
					{ lag_ms: Math.round(lag), in_flight: inFlight.size },
					"the task heartbeat ran late",
				);
			}

			void beat();
		}, heartbeatIntervalMs);

		// A heartbeat must never be the reason the process stays alive.
		heartbeat.unref();
	}

	/**
	 * The metrics outcome for a run that reached a terminal state, or `null`.
	 *
	 * `aborted` and `fenced` are deliberately unrecorded: the counter's help calls
	 * it tasks *run to completion*, and both of those leave the row for another
	 * attempt that will be counted when it ends. Counting them would make the
	 * total exceed the number of tasks that actually ran.
	 */
	function runOutcome(outcome: TaskOutcome): RunOutcome | null {
		if (outcome.status === "completed") {
			return "succeeded";
		}

		return outcome.status === "failed" ? "failed" : null;
	}

	async function dispatch(task: ClaimedTask): Promise<void> {
		const controller = new AbortController();

		inFlight.set(task.id, controller);

		const startedAt = performance.now();

		try {
			const outcome = await dispatchTask({
				ctx,
				db,
				logger,
				registry,
				signal: controller.signal,
				task,
				...(options.debounceMs !== undefined && {
					debounceMs: options.debounceMs,
				}),
			});

			logger.info(
				{ status: outcome.status, task_id: task.id, type: task.type },
				"finished a task",
			);

			const recorded = runOutcome(outcome);

			if (recorded !== null) {
				// Measured around the dispatch rather than from the row's `acquiredAt`,
				// which is Postgres's clock. Mixing the two to save one round trip's
				// worth of accuracy is how a duration histogram acquires a fixed skew.
				options.recordRun({
					type: task.type,
					outcome: recorded,
					durationSeconds: (performance.now() - startedAt) / 1_000,
				});
			}

			// `aborted` leaves the row carrying this runner's claim and incomplete —
			// a drain that ran out, or a terminal write the database refused. Handing
			// it back makes it claimable in milliseconds instead of after the whole
			// lease. `fenced` is not ours to release, and the other two are terminal.
			if (outcome.status === "aborted") {
				await release(task);
			}
		} catch (err) {
			// `runTask` always returns an outcome, so this is the genuinely
			// unexpected. The row still carries the claim either way, so release it.
			logger.error({ err, task_id: task.id }, "task dispatch failed");

			await release(task);
		} finally {
			inFlight.delete(task.id);
		}
	}

	async function tick(): Promise<void> {
		let claimed: ClaimedTask | null;

		try {
			claimed = await acquireTask(db, {
				runnerId,
				// Read from the registry on every poll, never snapshotted at
				// construction. Python snapshots `BaseTask.__subclasses__()`, which
				// holds only the classes already imported, so one missing import
				// silently narrows what its runner can claim. Reading live costs
				// nothing and removes the class of bug.
				allowedTypes: Object.keys(registry),
			});
		} catch (err) {
			// A connection blip or a serialization failure does not earn a
			// crash-loop, which is strictly worse than a poll that found nothing.
			logger.error({ err }, "failed to claim a task");

			return;
		}

		if (claimed === null) {
			return;
		}

		if (stopping.signal.aborted) {
			// The claim resolved after the drain began. Hand it back rather than
			// starting a body with no time left to finish in.
			await release(claimed);

			return;
		}

		await dispatch(claimed);
	}

	async function run(): Promise<void> {
		while (!stopping.signal.aborted) {
			try {
				await tick();
			} catch (err) {
				logger.error({ err }, "the task claim loop failed a poll");
			}

			lastTickAt = new Date();

			if (stopping.signal.aborted) {
				break;
			}

			try {
				await delay(pollIntervalMs, undefined, { signal: stopping.signal });
			} catch {
				// `stop()` aborted the wait; the loop condition ends it.
			}
		}
	}

	/**
	 * Stop claiming, wait out the in-flight work, then hand back what is left.
	 *
	 * Drain-then-release rather than drain-to-completion, which is not on offer at
	 * any grace period we can set: these tasks run for minutes and a cluster
	 * autoscaler force-removes a pod regardless of the field. A released task is
	 * claimable again in milliseconds; an abandoned one sits out the full lease.
	 *
	 * Everything here is caught. `process.exitCode`, the listener, the pool and
	 * the Sentry flush belong to the shutdown controller that calls this, and a
	 * throw would take the steps after it down.
	 */
	async function drain(): Promise<void> {
		// Observed by the claim loop, which stops claiming; a poll already in flight
		// resolves and releases its result instead of dispatching it.
		stopping.abort();

		// The three phases share the one ceiling the hook declares. The grace is
		// clamped rather than validated, so a drain window too small to hold it
		// degrades to a shorter grace instead of overrunning the ceiling and being
		// abandoned mid-release.
		const graceMs = Math.max(
			0,
			Math.min(
				options.abortGraceMs ?? ABORT_GRACE_MS,
				options.drainTimeoutMs - RELEASE_RESERVE_MS,
			),
		);

		const waitMs = Math.max(
			0,
			options.drainTimeoutMs - graceMs - RELEASE_RESERVE_MS,
		);

		if (loop !== undefined && !(await settles(loop, waitMs))) {
			logger.warn(
				{ in_flight: inFlight.size, ms: waitMs },
				"the task drain window expired",
			);

			// Abort what is still running so a cooperative body stops rather than
			// working on past the release below.
			for (const controller of inFlight.values()) {
				controller.abort();
			}

			// Then wait for it to actually stop. The abort only *signals*; releasing
			// on top of it clears `runner_id` under a body that is still unwinding,
			// which makes `runTask`'s ownership renewal fail and skips the `cleanup`
			// the abort path is supposed to run. The heartbeat is still going here,
			// so the lease holds for however long the cleanup takes.
			if (!(await settles(loop, graceMs))) {
				logger.warn(
					{ in_flight: inFlight.size, ms: graceMs },
					"a task did not stop when it was aborted",
				);
			}
		}

		// After the drain, not before: a task still working needs its lease held.
		if (heartbeat !== undefined) {
			clearInterval(heartbeat);
			heartbeat = undefined;
		}

		try {
			const released = await releaseRunnerClaims(db, runnerId);

			if (released.length > 0) {
				logger.info({ task_ids: released }, "released the claims still held");
			}
		} catch (err) {
			logger.error({ err }, "failed to release this runner's claims");
		}
	}

	return {
		start() {
			if (loop !== undefined) {
				return;
			}

			logger.info(
				{ runner_id: runnerId, types: Object.keys(registry) },
				"task runner started",
			);

			startHeartbeat();

			loop = run();
		},

		stop() {
			if (stopped !== undefined) {
				// A second signal must not start a second drain: it would release a
				// claim the first pass is still draining.
				logger.warn("the task runner is already stopping");

				return stopped;
			}

			stopped = drain();

			return stopped;
		},

		getLastTickAt: () => lastTickAt,
	};
}
