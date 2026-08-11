import type { Db } from "@virtool/data/db/pg";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	CLIENT_EVENTS_CHANNEL,
	type ClientEvent,
} from "@virtool/data/events/channel";
import {
	acquireTask,
	type ClaimedTask,
	createTask,
} from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { eq } from "drizzle-orm";
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
import { defineTask, type TaskRegistry } from "./define";
import { runTask } from "./run";

const RUNNER = "ts-runner-a-1";
const OTHER_RUNNER = "ts-runner-b-2";

/** Long enough that no test's debounce window closes on its own. */
const NEVER_FIRES_MS = 60_000;

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

/** Insert a task and claim it, as the runner loop will. */
async function claim(
	context: Record<string, unknown> = {},
): Promise<ClaimedTask> {
	await createTask(db, "install_hmms", context);

	const claimed = await acquireTask(db, {
		runnerId: RUNNER,
		allowedTypes: ["install_hmms"],
	});

	if (claimed === null) {
		throw new Error("the task under test was not claimable");
	}

	return claimed;
}

/**
 * Collect the `client_events` frames published while `run` executes.
 *
 * The sentinel at the end is what makes a count sound: it is published after
 * everything `run` did, over the connection the emitter uses, so its arrival
 * proves every frame `run` published has already arrived. Waiting a fixed
 * interval instead would pass on a slow machine for the wrong reason.
 */
async function collectFrames(run: () => Promise<void>): Promise<ClientEvent[]> {
	const received: ClientEvent[] = [];
	let seal: () => void = () => undefined;
	const sealed = new Promise<void>((resolve) => {
		seal = resolve;
	});

	const subscription = await database.client.listen(
		CLIENT_EVENTS_CHANNEL,
		(payload) => {
			const event = JSON.parse(payload) as ClientEvent;

			if (event.domain === "roles" && event.resource_id === "sentinel") {
				seal();
				return;
			}

			received.push(event);
		},
	);

	try {
		await run();

		await database.client.notify(
			CLIENT_EVENTS_CHANNEL,
			JSON.stringify({
				domain: "roles",
				resource_id: "sentinel",
				operation: "update",
			}),
		);

		await sealed;
	} finally {
		await subscription.unlisten();
	}

	return received;
}

describe("defineTask", () => {
	it("erases the payload type so one registry holds unlike tasks", () => {
		const registry: TaskRegistry = {
			clone_reference: defineTask({
				type: "clone_reference",
				payload: z.object({ manifest: z.record(z.string(), z.number()) }),
				run: async () => undefined,
			}),
			install_hmms: defineTask({
				type: "install_hmms",
				payload: z.object({ release_id: z.number() }),
				run: async () => undefined,
			}),
		};

		expect(Object.keys(registry)).toEqual(["clone_reference", "install_hmms"]);
	});
});

describe("runTask", () => {
	it("dispatches the handler and marks the task complete", async () => {
		const task = await claim({ release_id: 7 });
		const seen: unknown[] = [];

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({ release_id: z.number() }),
			run: async ({ payload, taskId }) => {
				seen.push({ payload, taskId });
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(seen).toEqual([{ payload: { release_id: 7 }, taskId: task.id }]);
		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
		});
	});

	it("records the error and stops when the handler throws", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			run: async () => {
				throw new TypeError("kaboom");
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "failed", error: "TypeError: kaboom" });
		expect(await readRow(task.id)).toMatchObject({
			error: "TypeError: kaboom",
		});
	});

	it("rejects a payload the schema does not accept, before the handler runs", async () => {
		const task = await claim({ wrong: true });
		const run = vi.fn();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({ release_id: z.number() }),
			run,
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
		});

		expect(run).not.toHaveBeenCalled();
		expect(outcome.status).toBe("failed");
		expect((await readRow(task.id)).error).toContain("Invalid payload");
	});

	it("scales progress into an equal slice per declared step", async () => {
		const task = await claim();
		const steps = ["one", "two", "three", "four"] as const;
		const entries: Array<{ step: string | null; progress: number | null }> = [];

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps,
			run: async ({ helpers, taskId }) => {
				for (const name of steps) {
					await helpers.runStep(name, async (report) => {
						const row = await readRow(taskId);
						entries.push({ progress: row.progress, step: row.step });

						if (name === "three") {
							report(0.5);

							await vi.waitFor(async () => {
								expect((await readRow(taskId)).progress).toBe(62);
							});
						}
					});
				}
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: 5,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(entries).toEqual([
			{ progress: 0, step: "one" },
			{ progress: 25, step: "two" },
			{ progress: 50, step: "three" },
			{ progress: 75, step: "four" },
		]);
		expect(await readRow(task.id)).toMatchObject({
			progress: 100,
			step: "four",
		});
	});

	it("leaves the bar where a step that threw started", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps: ["one", "two", "three", "four"],
			run: async ({ helpers }) => {
				await helpers.runStep("one", async () => undefined);
				await helpers.runStep("two", async () => {
					throw new Error("boom");
				});
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "failed", error: "Error: boom" });
		expect(await readRow(task.id)).toMatchObject({
			error: "Error: boom",
			progress: 25,
			step: "two",
		});
	});

	it("never writes the bar below what a reclaimed task already reported", async () => {
		const claimed = await claim();

		// What a reclaim leaves behind: the previous attempt's progress on the row,
		// and a body about to start again from step zero.
		await db
			.update(tasks)
			.set({ progress: 87 })
			.where(eq(tasks.id, claimed.id));

		const task: ClaimedTask = { ...claimed, progress: 87 };
		let insideSecondStep: number | null = null;

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps: ["one", "two"],
			run: async ({ helpers, taskId }) => {
				await helpers.runStep("one", async (report) => {
					report(1);
				});

				await helpers.runStep("two", async () => {
					insideSecondStep = (await readRow(taskId)).progress;
				});
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(insideSecondStep).toBe(87);
		expect(await readRow(task.id)).toMatchObject({
			progress: 100,
			step: "two",
		});
	});

	it("drops the progress of a step the task does not declare", async () => {
		const task = await claim();
		let insideDeclaredStep: number | null = null;

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps: ["one", "two"],
			run: async ({ helpers, taskId }) => {
				// A typo against the declared steps. Taking the whole bar for it would
				// write 100 and silence every declared step after it.
				await helpers.runStep("on", async (report) => {
					report(1);
				});

				await helpers.runStep("two", async () => {
					insideDeclaredStep = (await readRow(taskId)).progress;
				});
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(insideDeclaredStep).toBe(50);
	});

	it("names an undeclared step and maps its reports straight onto 0–100", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			run: async ({ helpers, taskId }) => {
				await helpers.runStep("downloading", async (report) => {
					expect((await readRow(taskId)).step).toBe("downloading");

					report(0.4);

					await vi.waitFor(async () => {
						expect((await readRow(taskId)).progress).toBe(40);
					});
				});
			},
		});

		await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: 5,
		});

		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			progress: 100,
			step: "downloading",
		});
	});

	it("publishes a tasks frame for every step transition and the terminal write", async () => {
		const task = await claim();
		const steps = ["one", "two"] as const;

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps,
			run: async ({ helpers }) => {
				for (const name of steps) {
					await helpers.runStep(name, async () => undefined);
				}
			},
		});

		const frames = await collectFrames(async () => {
			await runTask({
				db,
				def,
				task,
				ctx: undefined,
				logger,
				signal: new AbortController().signal,
				debounceMs: NEVER_FIRES_MS,
			});
		});

		// Two step entries and the completion. A step writes nothing on its way
		// out: the next entry carries the same value, and the completion carries
		// the last step's end.
		expect(frames).toEqual(
			Array.from({ length: 3 }, () => ({
				domain: "tasks",
				resource_id: task.id,
				operation: "update",
			})),
		);
	});

	it("coalesces a burst of reports and still lands the last value", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			run: async ({ helpers }) => {
				await helpers.runStep("downloading", async (report) => {
					for (let done = 1; done <= 10; done += 1) {
						report(done * 0.097);
					}
				});

				throw new Error("boom");
			},
		});

		const frames = await collectFrames(async () => {
			await runTask({
				db,
				def,
				task,
				ctx: undefined,
				logger,
				signal: new AbortController().signal,
				debounceMs: NEVER_FIRES_MS,
			});
		});

		// The step entry, the flushed final value, and the failure — against ten
		// calls to `report`.
		expect(frames).toHaveLength(3);
		expect(await readRow(task.id)).toMatchObject({
			error: "Error: boom",
			progress: 97,
		});
	});

	it("ignores a decrease instead of failing the task", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps: ["only"],
			run: async ({ helpers }) => {
				await helpers.runStep("only", async (report) => {
					report(0.9);
					report(0.4);
				});
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "completed" });
		expect(await readRow(task.id)).toMatchObject({
			error: null,
			progress: 100,
		});
	});

	it("runs cleanup when the handler observes an abort and returns cleanly", async () => {
		const task = await claim();
		const controller = new AbortController();
		const cleanup = vi.fn(async () => undefined);

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			cleanup,
			run: async ({ signal }) => {
				controller.abort();

				if (signal.aborted) {
					return;
				}

				throw new Error("the signal did not reach the handler");
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: controller.signal,
		});

		expect(outcome).toEqual({ status: "aborted" });
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(await readRow(task.id)).toMatchObject({
			complete: false,
			error: null,
		});
	});

	it("does not run cleanup on success", async () => {
		const task = await claim();
		const cleanup = vi.fn(async () => undefined);

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			cleanup,
			run: async () => undefined,
		});

		await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
		});

		expect(cleanup).not.toHaveBeenCalled();
	});

	it("logs a throwing cleanup without overwriting the recorded error", async () => {
		const task = await claim();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			cleanup: async () => {
				throw new Error("cleanup also broke");
			},
			run: async () => {
				throw new TypeError("kaboom");
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({ status: "failed", error: "TypeError: kaboom" });
		expect((await readRow(task.id)).error).toBe("TypeError: kaboom");
	});

	it("returns without running the handler when the signal is already aborted", async () => {
		const task = await claim();
		const run = vi.fn();
		const cleanup = vi.fn(async () => undefined);
		const controller = new AbortController();

		controller.abort();

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			cleanup,
			run,
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: controller.signal,
		});

		expect(outcome).toEqual({ status: "aborted" });
		expect(run).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
		expect(await readRow(task.id)).toMatchObject({
			complete: false,
			error: null,
			progress: 0,
		});
	});

	it("does not run cleanup after a reclaim no progress write could reveal", async () => {
		const task = await claim();
		const cleanup = vi.fn(async () => undefined);

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			cleanup,
			run: async ({ taskId }) => {
				// Nothing has been reported, so the writer has no outstanding write to
				// discover the reclaim through.
				await db
					.update(tasks)
					.set({ runner_id: OTHER_RUNNER })
					.where(eq(tasks.id, taskId));

				throw new Error("boom");
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "fenced" });
		expect(cleanup).not.toHaveBeenCalled();
		expect(await readRow(task.id)).toMatchObject({
			complete: false,
			error: null,
		});
	});

	it("stops without writing when another runner has reclaimed the task", async () => {
		const task = await claim();
		const cleanup = vi.fn(async () => undefined);

		const def = defineTask({
			type: "install_hmms",
			payload: z.object({}),
			steps: ["only"],
			cleanup,
			run: async ({ helpers, taskId }) => {
				await helpers.runStep("only", async () => {
					await db
						.update(tasks)
						.set({ runner_id: OTHER_RUNNER })
						.where(eq(tasks.id, taskId));
				});
			},
		});

		const outcome = await runTask({
			db,
			def,
			task,
			ctx: undefined,
			logger,
			signal: new AbortController().signal,
			debounceMs: NEVER_FIRES_MS,
		});

		expect(outcome).toEqual({ status: "fenced" });
		expect(cleanup).not.toHaveBeenCalled();
		expect(await readRow(task.id)).toMatchObject({
			complete: false,
			error: null,
			progress: 0,
		});
	});
});
