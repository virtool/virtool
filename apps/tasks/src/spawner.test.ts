import { setTimeout as delay } from "node:timers/promises";
import { PeriodicTaskName } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import type { PeriodicSpawnOutcome } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vitest";
import { createTaskSpawner } from "./spawner";
import {
	PERIODIC_TASKS,
	type PeriodicTaskRegistration,
	SPAWN_TICK_INTERVAL_MS,
} from "./tasks/periodic";
import { taskRegistry } from "./tasks/registry";
import { waitFor } from "./testing/waitFor";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(tasks);
});

async function countTasks(type: string): Promise<number> {
	const rows = await db
		.select({ id: tasks.id })
		.from(tasks)
		.where(eq(tasks.type, type));

	return rows.length;
}

/**
 * Build a spawner over `schedule`, ticking fast enough for a test, and stop it
 * when the test finishes.
 */
function build(
	schedule: PeriodicTaskRegistration[],
	overrides: Partial<Parameters<typeof createTaskSpawner>[0]> = {},
) {
	const recordSpawn =
		vi.fn<(type: PeriodicTaskName, outcome: PeriodicSpawnOutcome) => void>();

	const spawner = createTaskSpawner({
		db,
		logger,
		recordSpawn,
		schedule,
		tickIntervalMs: 20,
		...overrides,
	});

	onTestFinished(async () => {
		await spawner.stop();
	});

	return { spawner, recordSpawn };
}

describe("PERIODIC_TASKS", () => {
	/**
	 * Pinning the list means adding a seventh type breaks a test, and so stays a
	 * deliberate act rather than a line someone appends.
	 */
	it("registers exactly the six periodic names", () => {
		expect(PERIODIC_TASKS.map(({ type }) => type).toSorted()).toEqual(
			[...PeriodicTaskName.options].toSorted(),
		);
	});

	/**
	 * A registration the registry has no handler for spawns a row the runner
	 * never claims — its claim filters on the registry's keys — so the row is
	 * never acquired and never fails. It sits queued instead, counted against the
	 * queue gauges, with nothing logging why.
	 */
	it("registers nothing the runner cannot claim", () => {
		expect(
			PERIODIC_TASKS.map(({ type }) => type).filter(
				(type) => !(type in taskRegistry),
			),
		).toEqual([]);
	});

	// Asserted against the intervals themselves rather than against the constants
	// this module exports, which would only prove the module agrees with itself.
	// Every figure but `cleanup_sessions` is Python's, so replacing that spawner
	// does not move the cadence a deployment already sees.
	it("carries Python's intervals", () => {
		expect(
			Object.fromEntries(
				PERIODIC_TASKS.map(({ type, intervalSeconds }) => [
					type,
					intervalSeconds,
				]),
			),
		).toEqual({
			sweep_blast: 30,
			refresh_hmms: 600,
			timeout_jobs: 600,
			evict_caches_lru: 3600,
			cleanup_sessions: 3600,
			reap_orphaned_uploads: 86400,
		});
	});

	// Python sleeps a hardcoded 30 s between ticks whatever the intervals are, so
	// a task's effective period is `max(30, interval)` quantised to that tick.
	it("ticks on Python's 30 second period", () => {
		expect(SPAWN_TICK_INTERVAL_MS).toBe(30_000);
	});
});

describe("createTaskSpawner", () => {
	it("rejects a non-positive interval at construction", () => {
		for (const intervalSeconds of [0, -1, Number.NaN]) {
			expect(() =>
				createTaskSpawner({
					db,
					logger,
					recordSpawn: vi.fn(),
					schedule: [{ type: "sweep_blast", intervalSeconds }],
				}),
			).toThrow(/positive number of seconds/);
		}
	});

	it("spawns every registered task on its first tick", async () => {
		const { spawner, recordSpawn } = build([
			{ type: "sweep_blast", intervalSeconds: 30 },
			{ type: "refresh_hmms", intervalSeconds: 600 },
		]);

		spawner.start();

		await waitFor(async () => spawner.getLastTickAt() !== null);

		expect(await countTasks("sweep_blast")).toBe(1);
		expect(await countTasks("refresh_hmms")).toBe(1);

		expect(recordSpawn.mock.calls).toEqual([
			["sweep_blast", "spawned"],
			["refresh_hmms", "spawned"],
		]);
	});

	it("suppresses a spawn while the window is still open", async () => {
		const { spawner, recordSpawn } = build([
			{ type: "refresh_hmms", intervalSeconds: 600 },
		]);

		spawner.start();

		await waitFor(async () =>
			recordSpawn.mock.calls.some(([, outcome]) => outcome === "not_due"),
		);

		await spawner.stop();

		expect(await countTasks("refresh_hmms")).toBe(1);
	});

	/**
	 * The types are independent, and a `sweep_blast` that cannot be inserted is
	 * no reason for `refresh_hmms` to go unconsidered for another thirty seconds.
	 * The loop must survive it too — a crash-looping spawner is strictly worse
	 * than a tick that partly failed.
	 */
	it("keeps ticking when one task type fails", async () => {
		const { spawner, recordSpawn } = build([
			{ type: "sweep_blast", intervalSeconds: 30 },
			{ type: "refresh_hmms", intervalSeconds: 600 },
		]);

		// `sweep_blast` is first in the schedule, so the one rejected transaction
		// is its own.
		const failing = vi.spyOn(db, "transaction").mockImplementationOnce(() => {
			throw new Error("boom");
		});

		spawner.start();

		await waitFor(async () => recordSpawn.mock.calls.length > 0);

		expect(failing).toHaveBeenCalled();

		// The failed type recorded nothing — there is no error outcome on the
		// counter — but the tick carried on to the next one.
		expect(recordSpawn.mock.calls[0]).toEqual(["refresh_hmms", "spawned"]);
		expect(await countTasks("refresh_hmms")).toBe(1);

		failing.mockRestore();

		// And the loop is still running: the type that failed spawns next tick.
		await waitFor(async () => (await countTasks("sweep_blast")) === 1);
	});

	it("does not start a second loop", async () => {
		const { spawner } = build([{ type: "sweep_blast", intervalSeconds: 30 }]);

		spawner.start();
		spawner.start();

		await waitFor(async () => spawner.getLastTickAt() !== null);
		await spawner.stop();

		expect(await countTasks("sweep_blast")).toBe(1);
	});

	it("stops ticking, and stops again without complaint", async () => {
		const { spawner } = build([{ type: "sweep_blast", intervalSeconds: 30 }]);

		spawner.start();

		await waitFor(async () => spawner.getLastTickAt() !== null);

		await Promise.all([spawner.stop(), spawner.stop()]);

		const ticked = spawner.getLastTickAt();

		// Nothing is left running to advance it.
		await delay(100);

		expect(spawner.getLastTickAt()).toEqual(ticked);
	});

	it("stops cleanly before it has ever started", async () => {
		const { spawner } = build([{ type: "sweep_blast", intervalSeconds: 30 }]);

		await expect(spawner.stop()).resolves.toBeUndefined();
	});

	it("spawns again once the window has closed and the run has finished", async () => {
		const { spawner } = build([{ type: "sweep_blast", intervalSeconds: 30 }]);

		spawner.start();

		await waitFor(async () => (await countTasks("sweep_blast")) === 1);

		// Age the row past its window rather than waiting thirty seconds for it.
		await db
			.update(tasks)
			.set({
				created_at: sql`timezone('utc', clock_timestamp()) - make_interval(secs => 31)`,
			})
			.where(eq(tasks.type, "sweep_blast"));

		// An aged row is not on its own enough: it is still outstanding work, and
		// respawning alongside it is the backlog this gate exists to bound.
		await delay(200);
		expect(await countTasks("sweep_blast")).toBe(1);

		await db
			.update(tasks)
			.set({ complete: true })
			.where(eq(tasks.type, "sweep_blast"));

		await waitFor(async () => (await countTasks("sweep_blast")) === 2);
	});
});
