import type { Db } from "@virtool/data/db/pg";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	acquireTask,
	type ClaimedTask,
	createTask,
	TASK_LEASE_SECONDS,
} from "@virtool/data/tasks/data";
import { collectFrames } from "@virtool/data/test/frames";
import { createLogger, type Logger } from "@virtool/logger";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { z } from "zod";
import { defineTask, type TaskRegistry } from "./framework/define";
import type { TaskRunSample } from "./metrics/registry";
import { createTaskRunner, dispatchTask, type TaskRunner } from "./runner";
import { waitFor } from "./testing/waitFor";

const RUNNER = "ts-runner-a-1";

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

async function readRow(taskId: number) {
	const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

	if (row === undefined) {
		throw new Error(`no task row with id ${taskId}`);
	}

	return row;
}

/** Put a task in the state a runner holding a lease `ageSeconds` old leaves it. */
async function holdTask(
	taskId: number,
	runnerId: string,
	ageSeconds: number,
): Promise<void> {
	await db
		.update(tasks)
		.set({
			acquired_at: sql`timezone('utc', clock_timestamp()) - make_interval(secs => ${ageSeconds}::double precision)`,
			runner_id: runnerId,
		})
		.where(eq(tasks.id, taskId));
}

/** A task type that does nothing, for a test that only cares it was dispatched. */
function noopTask(run: () => Promise<void> = async () => undefined) {
	return defineTask({ type: "install_hmms", payload: z.object({}), run });
}

type RunnerOverrides = {
	abortGraceMs?: number;
	drainTimeoutMs?: number;
	heartbeatIntervalMs?: number;
	pollIntervalMs?: number;
	recordRun?: (sample: TaskRunSample) => void;
};

function buildRunner(
	registry: TaskRegistry,
	overrides: RunnerOverrides = {},
): TaskRunner {
	return createTaskRunner<unknown>({
		ctx: undefined,
		db,
		drainTimeoutMs: overrides.drainTimeoutMs ?? 5_000,
		logger,
		recordRun: overrides.recordRun ?? (() => undefined),
		// Fast enough that a test does not wait out Python's two seconds, and the
		// interval is injectable for exactly that reason.
		pollIntervalMs: overrides.pollIntervalMs ?? 10,
		registry,
		runnerId: RUNNER,
		// A body that ignores its signal burns the whole grace, so the tests that
		// use one shorten it rather than waiting out the real three seconds twice.
		abortGraceMs: overrides.abortGraceMs ?? 50,
		...(overrides.heartbeatIntervalMs !== undefined && {
			heartbeatIntervalMs: overrides.heartbeatIntervalMs,
		}),
	});
}

describe("createTaskRunner", () => {
	it("claims a pending task, dispatches its handler, and completes it", async () => {
		const taskId = await createTask(db, "install_hmms", { release_id: 3 });
		const seen: number[] = [];

		const runner = buildRunner({
			install_hmms: defineTask({
				type: "install_hmms",
				payload: z.object({ release_id: z.number() }),
				run: async ({ payload }) => {
					seen.push(payload.release_id);
				},
			}),
		});

		runner.start();

		try {
			await waitFor(async () => (await readRow(taskId)).complete === true);
		} finally {
			await runner.stop();
		}

		expect(seen).toEqual([3]);
		expect(await readRow(taskId)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
		});
	});

	// Python snapshots `BaseTask.__subclasses__()` at construction, which holds
	// only the classes already imported — so one missing import silently narrows
	// what its runner can claim, with nothing to say so.
	it("reads the supported types from the registry at claim time", async () => {
		const registry: TaskRegistry = {};
		const runner = buildRunner(registry);

		runner.start();

		try {
			await waitFor(async () => runner.getLastTickAt() !== null);

			const taskId = await createTask(db, "install_hmms");
			const before = runner.getLastTickAt()?.getTime() ?? 0;

			// An empty registry claims nothing at all rather than claiming work it
			// cannot run, so the row survives a full poll untouched.
			await waitFor(
				async () => (runner.getLastTickAt()?.getTime() ?? 0) > before,
			);

			expect(await readRow(taskId)).toMatchObject({ acquired_at: null });

			registry.install_hmms = noopTask();

			await waitFor(async () => (await readRow(taskId)).complete === true);
		} finally {
			await runner.stop();
		}
	});

	it("advances a last-tick timestamp for the probe seam", async () => {
		const runner = buildRunner({});

		expect(runner.getLastTickAt()).toBeNull();

		runner.start();

		try {
			await waitFor(async () => runner.getLastTickAt() !== null);

			const first = runner.getLastTickAt()?.getTime() ?? 0;

			await waitFor(
				async () => (runner.getLastTickAt()?.getTime() ?? 0) > first,
			);
		} finally {
			await runner.stop();
		}
	});

	// A crash-loop on a database hiccup is strictly worse than a poll that found
	// nothing.
	it("logs a failed claim and keeps polling", async () => {
		const taskId = await createTask(db, "install_hmms");

		const update = vi.spyOn(db, "update").mockImplementationOnce(() => {
			throw new Error("connection reset by peer");
		});

		const runner = buildRunner({ install_hmms: noopTask() });

		runner.start();

		try {
			await waitFor(async () => (await readRow(taskId)).complete === true);

			// Asserted before the restore, which resets the call history with it.
			expect(update).toHaveBeenCalled();
		} finally {
			await runner.stop();
			update.mockRestore();
		}
	});

	it("renews the lease of a task that outlives a heartbeat", async () => {
		const taskId = await createTask(db, "install_hmms");

		let finish: () => void = () => undefined;
		const held = new Promise<void>((resolve) => {
			finish = resolve;
		});

		const runner = buildRunner(
			{ install_hmms: noopTask(() => held) },
			{ heartbeatIntervalMs: 25 },
		);

		let first: number | undefined;

		runner.start();

		try {
			await waitFor(async () => {
				const { acquired_at } = await readRow(taskId);

				if (acquired_at === null) {
					return false;
				}

				first ??= acquired_at.getTime();

				return acquired_at.getTime() > first;
			});
		} finally {
			finish();
			await runner.stop();
		}
	});

	// The scope is what converts "make sure Python was drained first" from an
	// operational hope into something the query enforces. Widening it belongs to
	// the cutover, after Python's deployment is deleted — and this assertion is
	// what stops a refactor doing it quietly.
	it("reclaims an expired ts- lease and never touches Python's", async () => {
		const ours = await createTask(db, "install_hmms");
		const pythons = await createTask(db, "install_hmms");

		await holdTask(ours, "ts-gone-1", TASK_LEASE_SECONDS + 60);
		await holdTask(pythons, "somehost-4242", TASK_LEASE_SECONDS * 100);

		const ran: number[] = [];

		const runner = buildRunner({
			install_hmms: defineTask({
				type: "install_hmms",
				payload: z.object({}),
				run: async ({ taskId }) => {
					ran.push(taskId);
				},
			}),
		});

		runner.start();

		try {
			await waitFor(async () => (await readRow(ours)).complete === true);
		} finally {
			await runner.stop();
		}

		expect(ran).toEqual([ours]);
		expect(await readRow(pythons)).toMatchObject({
			complete: false,
			runner_id: "somehost-4242",
		});
	});

	// Release converts an abandoned task from the full lease of dead time into
	// milliseconds, which is the whole point of drain-then-release.
	it("releases a claim still in flight when the drain window expires", async () => {
		const taskId = await createTask(db, "install_hmms");

		let started: () => void = () => undefined;
		const running = new Promise<void>((resolve) => {
			started = resolve;
		});

		const runner = buildRunner(
			{
				install_hmms: noopTask(async () => {
					started();

					// Ends only when the drain aborts it.
					await new Promise<void>(() => undefined);
				}),
			},
			// The reserve inside the runner leaves the wait very short and the
			// release the rest.
			{ drainTimeoutMs: 2_100 },
		);

		runner.start();

		await running;
		await runner.stop();

		expect(await readRow(taskId)).toMatchObject({
			acquired_at: null,
			complete: false,
			runner_id: null,
		});
	});

	// Releasing on top of the abort clears `runner_id` under a body that is still
	// unwinding, so `runTask`'s ownership renewal fails, the run reports `fenced`,
	// and the cleanup the abort path is supposed to run is skipped silently.
	it("lets an aborted task run its cleanup before releasing its claim", async () => {
		const taskId = await createTask(db, "install_hmms");
		const cleaned: number[] = [];

		let started: () => void = () => undefined;
		const running = new Promise<void>((resolve) => {
			started = resolve;
		});

		const runner = buildRunner(
			{
				install_hmms: defineTask({
					type: "install_hmms",
					payload: z.object({}),
					cleanup: async ({ taskId: id }) => {
						cleaned.push(id);
					},
					// Cooperative: it notices the abort and returns *cleanly*, which is
					// the path a `catch`-only implementation misses entirely.
					run: async ({ signal }) => {
						started();

						await new Promise<void>((resolve) => {
							signal.addEventListener("abort", () => resolve(), { once: true });
						});
					},
				}),
			},
			{ abortGraceMs: 2_000, drainTimeoutMs: 2_200 },
		);

		runner.start();

		await running;
		await runner.stop();

		expect(cleaned).toEqual([taskId]);
		expect(await readRow(taskId)).toMatchObject({
			acquired_at: null,
			complete: false,
			runner_id: null,
		});
	});

	it("does not re-enter the drain on a second stop", async () => {
		const taskId = await createTask(db, "install_hmms");

		let started: () => void = () => undefined;
		const running = new Promise<void>((resolve) => {
			started = resolve;
		});

		const runner = buildRunner(
			{
				install_hmms: noopTask(async () => {
					started();
					await new Promise<void>(() => undefined);
				}),
			},
			{ drainTimeoutMs: 2_100 },
		);

		runner.start();

		await running;

		const first = runner.stop();

		// The same promise, not a second drain: a second signal that started one
		// would release a claim the first pass is still draining.
		expect(runner.stop()).toBe(first);

		await first;

		await expect(runner.stop()).resolves.toBeUndefined();

		expect(await readRow(taskId)).toMatchObject({
			acquired_at: null,
			runner_id: null,
		});
	});

	describe("run metrics", () => {
		it("records a completed run as succeeded", async () => {
			const taskId = await createTask(db, "install_hmms");
			const samples: TaskRunSample[] = [];

			const runner = buildRunner(
				{ install_hmms: noopTask() },
				{
					recordRun: (sample) => {
						samples.push(sample);
					},
				},
			);

			runner.start();

			try {
				await waitFor(async () => (await readRow(taskId)).complete === true);
			} finally {
				await runner.stop();
			}

			expect(samples).toHaveLength(1);
			expect(samples[0]).toMatchObject({
				type: "install_hmms",
				outcome: "succeeded",
			});
			expect(samples[0]?.durationSeconds).toBeGreaterThanOrEqual(0);
		});

		it("records a thrown run as failed", async () => {
			const taskId = await createTask(db, "install_hmms");
			const samples: TaskRunSample[] = [];

			const runner = buildRunner(
				{
					install_hmms: noopTask(async () => {
						throw new TypeError("kaboom");
					}),
				},
				{
					recordRun: (sample) => {
						samples.push(sample);
					},
				},
			);

			runner.start();

			try {
				await waitFor(async () => (await readRow(taskId)).error !== null);
			} finally {
				await runner.stop();
			}

			expect(samples).toEqual([
				{
					type: "install_hmms",
					outcome: "failed",
					durationSeconds: expect.any(Number),
				},
			]);
		});

		// The counter's help calls it tasks run to completion. An abort leaves the
		// row for another attempt, which will be counted when it ends — counting it
		// here too would put the total above the number of tasks that ran.
		it("records nothing for a run the drain aborted", async () => {
			await createTask(db, "install_hmms");
			const samples: TaskRunSample[] = [];

			let started: () => void = () => undefined;
			const running = new Promise<void>((resolve) => {
				started = resolve;
			});

			const runner = buildRunner(
				{
					install_hmms: noopTask(async () => {
						started();
						await new Promise<void>(() => undefined);
					}),
				},
				{
					drainTimeoutMs: 2_100,
					recordRun: (sample) => {
						samples.push(sample);
					},
				},
			);

			runner.start();

			await running;
			await runner.stop();

			expect(samples).toEqual([]);
		});
	});

	// The runner emits nothing itself. Every frame comes from the data layer,
	// beside the write — which is why a claim produces none at all.
	it("publishes one tasks frame for the completion and none for the claim", async () => {
		const taskId = await createTask(db, "install_hmms");
		const runner = buildRunner({ install_hmms: noopTask() });

		const frames = await collectFrames(database.client, async () => {
			runner.start();

			try {
				await waitFor(async () => (await readRow(taskId)).complete === true);
			} finally {
				await runner.stop();
			}
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: taskId, operation: "update" },
		]);
	});
});

describe("dispatchTask", () => {
	/** Claim a task by hand, which is the only way to get one of an unknown type. */
	async function claimDirectly(type: string): Promise<ClaimedTask> {
		await db.insert(tasks).values({
			complete: false,
			context: {},
			count: 0,
			created_at: new Date(),
			progress: 0,
			step: type,
			type,
		});

		const claimed = await acquireTask(db, {
			runnerId: RUNNER,
			allowedTypes: [type],
		});

		if (claimed === null) {
			throw new Error("the task under test was not claimable");
		}

		return claimed;
	}

	// Python acquires the row, finds no class for the name, logs and returns —
	// leaving it claimed, incomplete and error-free. That row is invisible to
	// every consumer, counted as running forever, and drawn as a bar that never
	// moves. It is the documented cause of the abandoned KEDA trigger.
	it("fails a task with no registered handler rather than stranding it", async () => {
		const task = await claimDirectly("no_such_task");

		const outcome = await dispatchTask({
			ctx: undefined,
			db,
			logger,
			registry: {},
			signal: new AbortController().signal,
			task,
		});

		const message = 'no handler registered for task type "no_such_task"';

		expect(outcome).toEqual({ status: "failed", error: message });

		const row = await readRow(task.id);

		expect(row).toMatchObject({ complete: true, error: message });

		// The exact Python failure state, asserted by name.
		expect(
			row.acquired_at !== null && row.error === null && row.complete === false,
		).toBe(false);
	});

	// Releasing instead would hot-loop: an unknown row is claimable by
	// construction, so it comes straight back on the next poll forever.
	it("leaves a task it failed for having no handler unclaimable", async () => {
		const task = await claimDirectly("no_such_task");

		await dispatchTask({
			ctx: undefined,
			db,
			logger,
			registry: {},
			signal: new AbortController().signal,
			task,
		});

		await expect(
			acquireTask(db, { runnerId: RUNNER, allowedTypes: ["no_such_task"] }),
		).resolves.toBeNull();
	});

	it("publishes a tasks frame for a type it has no handler for", async () => {
		const task = await claimDirectly("no_such_task");

		const frames = await collectFrames(database.client, async () => {
			await dispatchTask({
				ctx: undefined,
				db,
				logger,
				registry: {},
				signal: new AbortController().signal,
				task,
			});
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: task.id, operation: "update" },
		]);
	});
});
