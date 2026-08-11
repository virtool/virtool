import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
} from "vitest";

import type { Db } from "../db/pg";
import { tasks } from "../db/schema/tasks";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { CLIENT_EVENTS_CHANNEL, type ClientEvent } from "../events/channel";
import {
	acquireTask,
	buildRunnerId,
	completeTask,
	createTask,
	failTask,
	getTask,
	getTasks,
	readOldestQueuedTaskAges,
	readTaskCounts,
	readTaskQueueBounded,
	reclaimExpiredLeases,
	releaseRunnerClaims,
	releaseTask,
	renewLeases,
	TASK_HEARTBEAT_SECONDS,
	TASK_LEASE_SECONDS,
	TaskNotFoundError,
	updateTaskProgress,
} from "./data";

let database: TestDatabase;
let db: Db;

const RUNNER_A = "ts-runner-a-1";
const RUNNER_B = "ts-runner-b-2";

const ALL_TYPES = [
	"clone_reference",
	"create_index",
	"import_reference",
	"install_hmms",
] as const;

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

/** Read a row straight out of the table, bypassing every mapper. */
async function readRow(taskId: number) {
	const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

	return row;
}

/** Put `taskId` in the state a runner holding a lease `secondsAgo` old leaves. */
async function holdTask(
	taskId: number,
	runnerId: string,
	secondsAgo: number,
): Promise<void> {
	await db
		.update(tasks)
		.set({
			acquired_at: new Date(Date.now() - secondsAgo * 1000),
			runner_id: runnerId,
		})
		.where(eq(tasks.id, taskId));
}

describe("createTask", () => {
	it("inserts a pending task the runner will claim", async () => {
		const taskId = await createTask(db, "install_hmms", { user_id: 1 });

		expect(await readRow(taskId)).toMatchObject({
			type: "install_hmms",
			step: "install_hmms",
			context: { user_id: 1 },
			complete: false,
			progress: 0,
			acquired_at: null,
			error: null,
		});
	});

	it("defaults the context to an empty object", async () => {
		const taskId = await createTask(db, "install_hmms");

		expect((await readRow(taskId))?.context).toEqual({});
	});
});

describe("getTask", () => {
	it("returns the created task", async () => {
		const taskId = await createTask(db, "install_hmms");

		await expect(getTask(db, taskId)).resolves.toMatchObject({
			id: taskId,
			type: "install_hmms",
			complete: false,
			progress: 0,
		});
	});

	it("throws TaskNotFoundError when the task is absent", async () => {
		await expect(getTask(db, 404_404)).rejects.toThrow(TaskNotFoundError);
	});
});

describe("getTasks", () => {
	it("returns every requested task", async () => {
		const first = await createTask(db, "install_hmms");
		const second = await createTask(db, "clone_reference");

		const found = await getTasks(db, [first, second]);

		expect(found.map((task) => task.id).sort()).toEqual([first, second].sort());
	});

	it("omits ids with no row rather than throwing", async () => {
		const taskId = await createTask(db, "install_hmms");

		await expect(getTasks(db, [taskId, 404_404])).resolves.toMatchObject([
			{ id: taskId },
		]);
	});

	it("returns an empty array for empty input", async () => {
		await expect(getTasks(db, [])).resolves.toEqual([]);
	});
});

describe("buildRunnerId", () => {
	it("marks the runner as this service's and names the process", () => {
		const runnerId = buildRunnerId();

		expect(runnerId.startsWith("ts-")).toBe(true);
		expect(runnerId.endsWith(`-${process.pid}`)).toBe(true);
	});
});

describe("lease constants", () => {
	it("leaves room for four missed heartbeats", () => {
		expect(TASK_LEASE_SECONDS).toBe(300);
		expect(TASK_HEARTBEAT_SECONDS).toBe(60);
		expect(TASK_LEASE_SECONDS / TASK_HEARTBEAT_SECONDS).toBe(5);
	});
});

describe("acquireTask", () => {
	it("claims a pending task and stamps the lease", async () => {
		const taskId = await createTask(db, "install_hmms", { user_id: 3 });

		const claimed = await acquireTask(db, {
			runnerId: RUNNER_A,
			allowedTypes: ["install_hmms"],
		});

		expect(claimed).toMatchObject({
			id: taskId,
			type: "install_hmms",
			context: { user_id: 3 },
			progress: 0,
			runnerId: RUNNER_A,
			step: "install_hmms",
		});
		expect(claimed?.acquiredAt).toBeInstanceOf(Date);

		expect(await readRow(taskId)).toMatchObject({ runner_id: RUNNER_A });
	});

	it("takes the oldest task first", async () => {
		const older = await createTask(db, "install_hmms");
		const newer = await createTask(db, "install_hmms");

		await db
			.update(tasks)
			.set({ created_at: new Date("2020-01-01T00:00:00Z") })
			.where(eq(tasks.id, newer));

		const claimed = await acquireTask(db, {
			runnerId: RUNNER_A,
			allowedTypes: ["install_hmms"],
		});

		expect(claimed?.id).toBe(newer);
		expect(claimed?.id).not.toBe(older);
	});

	it("claims only the allowed types", async () => {
		await createTask(db, "install_hmms");

		await expect(
			acquireTask(db, {
				runnerId: RUNNER_A,
				allowedTypes: ["clone_reference"],
			}),
		).resolves.toBeNull();
	});

	it("returns null when the runner allows no types at all", async () => {
		await createTask(db, "install_hmms");

		await expect(
			acquireTask(db, { runnerId: RUNNER_A, allowedTypes: [] }),
		).resolves.toBeNull();
	});

	it("returns null when nothing is waiting", async () => {
		await expect(
			acquireTask(db, { runnerId: RUNNER_A, allowedTypes: [...ALL_TYPES] }),
		).resolves.toBeNull();
	});

	it("claims a pending task that has already reported progress", async () => {
		// Python's claim carries an `AND progress = 0` term, which excludes exactly
		// the rows a reclaim exists for: work abandoned part-way through.
		const taskId = await createTask(db, "install_hmms");

		await db.update(tasks).set({ progress: 42 }).where(eq(tasks.id, taskId));

		const claimed = await acquireTask(db, {
			runnerId: RUNNER_A,
			allowedTypes: ["install_hmms"],
		});

		expect(claimed).toMatchObject({ id: taskId, progress: 42 });
	});

	it("ignores a completed task", async () => {
		const taskId = await createTask(db, "install_hmms");

		await db.update(tasks).set({ complete: true }).where(eq(tasks.id, taskId));

		await expect(
			acquireTask(db, { runnerId: RUNNER_A, allowedTypes: ["install_hmms"] }),
		).resolves.toBeNull();
	});

	it("ignores a failed task", async () => {
		const taskId = await createTask(db, "install_hmms");

		await db.update(tasks).set({ error: "boom" }).where(eq(tasks.id, taskId));

		await expect(
			acquireTask(db, { runnerId: RUNNER_A, allowedTypes: ["install_hmms"] }),
		).resolves.toBeNull();
	});

	it("reclaims a lease that has run out", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, TASK_LEASE_SECONDS + 60);

		const claimed = await acquireTask(db, {
			runnerId: RUNNER_B,
			allowedTypes: ["install_hmms"],
		});

		expect(claimed).toMatchObject({ id: taskId, runnerId: RUNNER_B });
	});

	it("leaves a live lease alone", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, TASK_LEASE_SECONDS - 60);

		await expect(
			acquireTask(db, { runnerId: RUNNER_B, allowedTypes: ["install_hmms"] }),
		).resolves.toBeNull();

		expect(await readRow(taskId)).toMatchObject({ runner_id: RUNNER_A });
	});

	it("never reclaims a task Python is holding", async () => {
		// Python does not renew `acquired_at`, so any long-running task of its
		// looks abandoned. The `ts-` scoping is the only thing keeping this side
		// from pulling live work out from under it.
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, "somehost-4242", TASK_LEASE_SECONDS * 100);

		await expect(
			acquireTask(db, { runnerId: RUNNER_B, allowedTypes: ["install_hmms"] }),
		).resolves.toBeNull();

		expect(await readRow(taskId)).toMatchObject({ runner_id: "somehost-4242" });
	});

	it("honours a shorter lease passed by the caller", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 30);

		await expect(
			acquireTask(db, {
				runnerId: RUNNER_B,
				allowedTypes: ["install_hmms"],
				leaseSeconds: 10,
			}),
		).resolves.toMatchObject({ id: taskId, runnerId: RUNNER_B });
	});

	it("gives one task to exactly one of two racing runners", async () => {
		const taskId = await createTask(db, "install_hmms");

		const first = database.connect();
		const second = database.connect();

		onTestFinished(async () => {
			await Promise.all([first.close(), second.close()]);
		});

		const claimed = await Promise.all([
			acquireTask(first.db, {
				runnerId: RUNNER_A,
				allowedTypes: ["install_hmms"],
			}),
			acquireTask(second.db, {
				runnerId: RUNNER_B,
				allowedTypes: ["install_hmms"],
			}),
		]);

		const winners = claimed.filter((task) => task !== null);

		expect(winners).toHaveLength(1);
		expect(winners[0]?.id).toBe(taskId);
		expect(await readRow(taskId)).toMatchObject({
			runner_id: winners[0]?.runnerId,
		});
	});
});

describe("renewLeases", () => {
	it("renews the leases the runner holds and reports them", async () => {
		const first = await createTask(db, "install_hmms");
		const second = await createTask(db, "clone_reference");

		await holdTask(first, RUNNER_A, TASK_LEASE_SECONDS - 30);
		await holdTask(second, RUNNER_A, TASK_LEASE_SECONDS - 30);

		const before = (await readRow(first))?.acquired_at;

		await expect(renewLeases(db, [first, second], RUNNER_A)).resolves.toEqual(
			expect.arrayContaining([first, second]),
		);

		const after = (await readRow(first))?.acquired_at;

		expect(after?.getTime()).toBeGreaterThan(before?.getTime() as number);
	});

	it("returns an empty array for empty input", async () => {
		await expect(renewLeases(db, [], RUNNER_A)).resolves.toEqual([]);
	});

	it("omits a task another runner now holds", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		await expect(renewLeases(db, [taskId], RUNNER_A)).resolves.toEqual([]);
	});

	it("omits a task that has already finished", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);
		await db.update(tasks).set({ complete: true }).where(eq(tasks.id, taskId));

		await expect(renewLeases(db, [taskId], RUNNER_A)).resolves.toEqual([]);
	});
});

describe("completeTask", () => {
	it("marks the task complete at full progress", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await expect(completeTask(db, taskId, RUNNER_A)).resolves.toBe(true);

		expect(await readRow(taskId)).toMatchObject({
			complete: true,
			progress: 100,
			error: null,
		});
	});

	it("refuses a runner that no longer holds the task", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		await expect(completeTask(db, taskId, RUNNER_A)).resolves.toBe(false);
	});

	it("refuses a task that is already complete", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await expect(completeTask(db, taskId, RUNNER_A)).resolves.toBe(true);
		await expect(completeTask(db, taskId, RUNNER_A)).resolves.toBe(false);
	});
});

describe("failTask", () => {
	it("records the error and finishes the task", async () => {
		// Python writes `error` alone and leaves `complete` false, which strands the
		// row outside both halves of its own `get_counts`. Failure is terminal here.
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await expect(failTask(db, taskId, RUNNER_A, "it broke")).resolves.toBe(
			true,
		);

		expect(await readRow(taskId)).toMatchObject({
			complete: true,
			error: "it broke",
		});
	});

	it("refuses a runner that no longer holds the task", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		await expect(failTask(db, taskId, RUNNER_A, "it broke")).resolves.toBe(
			false,
		);

		expect(await readRow(taskId)).toMatchObject({ error: null });
	});

	it("leaves a failed task unclaimable", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);
		await failTask(db, taskId, RUNNER_A, "it broke");
		await releaseRunnerClaims(db, RUNNER_A);

		await expect(
			acquireTask(db, { runnerId: RUNNER_B, allowedTypes: ["install_hmms"] }),
		).resolves.toBeNull();
	});
});

describe("updateTaskProgress", () => {
	it("writes progress and the step name", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await expect(
			updateTaskProgress(db, taskId, RUNNER_A, {
				progress: 55,
				step: "unpack",
			}),
		).resolves.toBe(true);

		expect(await readRow(taskId)).toMatchObject({
			progress: 55,
			step: "unpack",
		});
	});

	it("leaves the step alone when none is given", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await updateTaskProgress(db, taskId, RUNNER_A, { progress: 20 });

		expect(await readRow(taskId)).toMatchObject({
			progress: 20,
			step: "install_hmms",
		});
	});

	it("refuses a runner that no longer holds the task", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		await expect(
			updateTaskProgress(db, taskId, RUNNER_A, { progress: 55 }),
		).resolves.toBe(false);

		expect(await readRow(taskId)).toMatchObject({ progress: 0 });
	});
});

describe("releaseTask", () => {
	it("hands the task back for another runner to take", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		await expect(releaseTask(db, taskId, RUNNER_A)).resolves.toBe(true);

		expect(await readRow(taskId)).toMatchObject({
			acquired_at: null,
			runner_id: null,
		});

		await expect(
			acquireTask(db, { runnerId: RUNNER_B, allowedTypes: ["install_hmms"] }),
		).resolves.toMatchObject({ id: taskId });
	});

	it("refuses a runner that no longer holds the task", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		await expect(releaseTask(db, taskId, RUNNER_A)).resolves.toBe(false);

		expect(await readRow(taskId)).toMatchObject({ runner_id: RUNNER_B });
	});

	it("never releases a task Python is holding", async () => {
		// The scope has to hold at the query, not at the caller: a Python-format id
		// reaching this argument would otherwise hand live work to our fleet.
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, "somehost-4242", 10);

		await expect(releaseTask(db, taskId, "somehost-4242")).resolves.toBe(false);

		expect(await readRow(taskId)).toMatchObject({ runner_id: "somehost-4242" });
	});
});

describe("releaseRunnerClaims", () => {
	it("hands back every unfinished task the runner holds", async () => {
		const first = await createTask(db, "install_hmms");
		const second = await createTask(db, "clone_reference");
		const other = await createTask(db, "create_index");

		await holdTask(first, RUNNER_A, 10);
		await holdTask(second, RUNNER_A, 10);
		await holdTask(other, RUNNER_B, 10);

		await expect(releaseRunnerClaims(db, RUNNER_A)).resolves.toEqual(
			expect.arrayContaining([first, second]),
		);

		expect(await readRow(first)).toMatchObject({ runner_id: null });
		expect(await readRow(second)).toMatchObject({ runner_id: null });
		expect(await readRow(other)).toMatchObject({ runner_id: RUNNER_B });
	});

	it("leaves a finished task's record of who ran it", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);
		await completeTask(db, taskId, RUNNER_A);

		await expect(releaseRunnerClaims(db, RUNNER_A)).resolves.toEqual([]);

		expect(await readRow(taskId)).toMatchObject({ runner_id: RUNNER_A });
	});

	it("never releases the claims of a Python runner", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, "somehost-4242", 10);

		await expect(releaseRunnerClaims(db, "somehost-4242")).resolves.toEqual([]);

		expect(await readRow(taskId)).toMatchObject({ runner_id: "somehost-4242" });
	});
});

describe("reclaimExpiredLeases", () => {
	it("takes back a lease that has run out", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, TASK_LEASE_SECONDS + 60);

		await expect(reclaimExpiredLeases(db)).resolves.toEqual([taskId]);

		expect(await readRow(taskId)).toMatchObject({
			acquired_at: null,
			runner_id: null,
		});
	});

	it("leaves a live lease alone", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, TASK_LEASE_SECONDS - 60);

		await expect(reclaimExpiredLeases(db)).resolves.toEqual([]);
	});

	it("never touches a task Python is holding", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, "somehost-4242", TASK_LEASE_SECONDS * 100);

		await expect(reclaimExpiredLeases(db)).resolves.toEqual([]);

		expect(await readRow(taskId)).toMatchObject({ runner_id: "somehost-4242" });
	});

	it("leaves finished and failed tasks alone", async () => {
		const completed = await createTask(db, "install_hmms");
		const failed = await createTask(db, "clone_reference");

		await holdTask(completed, RUNNER_A, TASK_LEASE_SECONDS + 60);
		await holdTask(failed, RUNNER_A, TASK_LEASE_SECONDS + 60);

		await db
			.update(tasks)
			.set({ complete: true })
			.where(eq(tasks.id, completed));
		await db.update(tasks).set({ error: "boom" }).where(eq(tasks.id, failed));

		await expect(reclaimExpiredLeases(db)).resolves.toEqual([]);
	});

	it("honours a shorter lease passed by the caller", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 30);

		await expect(
			reclaimExpiredLeases(db, { leaseSeconds: 10 }),
		).resolves.toEqual([taskId]);
	});
});

describe("fencing", () => {
	it("shuts a runner out of a task whose lease it lost", async () => {
		const taskId = await createTask(db, "install_hmms");

		const held = await acquireTask(db, {
			runnerId: RUNNER_A,
			allowedTypes: ["install_hmms"],
		});

		expect(held?.id).toBe(taskId);

		// Runner A stalls for longer than the lease, and runner B picks the task up.
		await holdTask(taskId, RUNNER_A, TASK_LEASE_SECONDS + 60);

		await expect(
			acquireTask(db, { runnerId: RUNNER_B, allowedTypes: ["install_hmms"] }),
		).resolves.toMatchObject({ id: taskId, runnerId: RUNNER_B });

		// Runner A wakes up. Every write it can make is refused, and its heartbeat
		// is how it finds out.
		await expect(renewLeases(db, [taskId], RUNNER_A)).resolves.toEqual([]);
		await expect(
			updateTaskProgress(db, taskId, RUNNER_A, { progress: 90 }),
		).resolves.toBe(false);
		await expect(completeTask(db, taskId, RUNNER_A)).resolves.toBe(false);
		await expect(failTask(db, taskId, RUNNER_A, "too late")).resolves.toBe(
			false,
		);
		await expect(releaseTask(db, taskId, RUNNER_A)).resolves.toBe(false);

		expect(await readRow(taskId)).toMatchObject({
			complete: false,
			error: null,
			progress: 0,
			runner_id: RUNNER_B,
		});
	});
});

describe("timestamps", () => {
	it("writes UTC whatever the session's timezone is", async () => {
		// `timezone('utc', clock_timestamp())` is explicit and so immune to the
		// session's TimeZone. `localtimestamp`, or a `now()::timestamp`, is not —
		// it would store Vancouver's wall time in a column Python reads as UTC.
		const connection = database.connect();
		onTestFinished(() => connection.close());

		await connection.client.unsafe("set time zone 'America/Vancouver'");

		await createTask(db, "install_hmms");

		const claimed = await acquireTask(connection.db, {
			runnerId: RUNNER_A,
			allowedTypes: ["install_hmms"],
		});

		expect(
			Math.abs((claimed?.acquiredAt.getTime() as number) - Date.now()),
		).toBeLessThan(60_000);
	});
});

describe("frames", () => {
	/**
	 * Collect the `client_events` frames published while `run` executes.
	 *
	 * The sentinel at the end is what makes an assertion of *no* frames sound: it
	 * is published after everything `run` did, over the same connection the
	 * emitter uses, so its arrival proves any frame `run` published has already
	 * arrived too. Waiting a fixed interval instead would pass on a slow machine
	 * for the wrong reason.
	 */
	async function collectFrames(
		run: () => Promise<void>,
	): Promise<ClientEvent[]> {
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

	it("publishes one frame per progress write", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		const frames = await collectFrames(async () => {
			await updateTaskProgress(db, taskId, RUNNER_A, { progress: 10 });
			await updateTaskProgress(db, taskId, RUNNER_A, { progress: 20 });
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: taskId, operation: "update" },
			{ domain: "tasks", resource_id: taskId, operation: "update" },
		]);
	});

	it("publishes a frame when a task completes", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		const frames = await collectFrames(async () => {
			await completeTask(db, taskId, RUNNER_A);
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: taskId, operation: "update" },
		]);
	});

	it("publishes a frame when a task fails", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_A, 10);

		const frames = await collectFrames(async () => {
			await failTask(db, taskId, RUNNER_A, "it broke");
		});

		expect(frames).toEqual([
			{ domain: "tasks", resource_id: taskId, operation: "update" },
		]);
	});

	it("publishes nothing for claiming, releasing or reclaiming", async () => {
		const claimable = await createTask(db, "install_hmms");
		const expired = await createTask(db, "clone_reference");

		await holdTask(expired, RUNNER_B, TASK_LEASE_SECONDS + 60);

		const frames = await collectFrames(async () => {
			await acquireTask(db, {
				runnerId: RUNNER_A,
				allowedTypes: ["install_hmms"],
			});
			await renewLeases(db, [claimable], RUNNER_A);
			await releaseTask(db, claimable, RUNNER_A);
			await releaseRunnerClaims(db, RUNNER_A);
			await reclaimExpiredLeases(db);
		});

		expect(frames).toEqual([]);
	});

	it("publishes nothing when a fenced write changes nothing", async () => {
		const taskId = await createTask(db, "install_hmms");
		await holdTask(taskId, RUNNER_B, 10);

		const frames = await collectFrames(async () => {
			await updateTaskProgress(db, taskId, RUNNER_A, { progress: 10 });
			await completeTask(db, taskId, RUNNER_A);
			await failTask(db, taskId, RUNNER_A, "it broke");
		});

		expect(frames).toEqual([]);
	});
});

describe("readTaskCounts", () => {
	it("splits active tasks into queued and running, by type", async () => {
		await createTask(db, "install_hmms");
		const running = await createTask(db, "install_hmms");
		const other = await createTask(db, "create_index");

		await holdTask(running, RUNNER_A, 10);
		await holdTask(other, RUNNER_A, 10);

		const counts = await readTaskCounts(db);

		expect([...counts].sort((a, b) => a.type.localeCompare(b.type))).toEqual([
			{ type: "create_index", queued: 0, running: 1 },
			{ type: "install_hmms", queued: 1, running: 1 },
		]);
	});

	it("counts a type the union does not name", async () => {
		await db.insert(tasks).values({
			complete: false,
			context: {},
			count: 0,
			created_at: new Date(),
			progress: 0,
			step: "a_python_task",
			type: "a_python_task",
		});

		expect(await readTaskCounts(db)).toEqual([
			{ type: "a_python_task", queued: 1, running: 0 },
		]);
	});

	// The predicate is Python's `get_counts`, and the pre/post-cutover comparison
	// only holds if both sides count the same rows. A failure is the case worth
	// pinning: `failTask` sets `complete` as well as `error`, but Python's failure
	// path writes `error` alone, so a row can be failed and incomplete at once.
	it("excludes complete, failed, and failed-but-incomplete tasks", async () => {
		const completed = await createTask(db, "install_hmms");
		await holdTask(completed, RUNNER_A, 1);
		await completeTask(db, completed, RUNNER_A);

		const failed = await createTask(db, "install_hmms");
		await holdTask(failed, RUNNER_A, 1);
		await failTask(db, failed, RUNNER_A, "it broke");

		const pythonStyleFailure = await createTask(db, "install_hmms");
		await db
			.update(tasks)
			.set({ error: "python wrote this" })
			.where(eq(tasks.id, pythonStyleFailure));

		expect(await readTaskCounts(db)).toEqual([]);
	});

	it("returns nothing for an empty queue", async () => {
		expect(await readTaskCounts(db)).toEqual([]);
	});
});

describe("readOldestQueuedTaskAges", () => {
	it("reports the oldest unclaimed task per type", async () => {
		const older = await createTask(db, "install_hmms");
		await createTask(db, "install_hmms");

		await db
			.update(tasks)
			.set({ created_at: new Date(Date.now() - 600 * 1000) })
			.where(eq(tasks.id, older));

		const [row] = await readOldestQueuedTaskAges(db);

		expect(row?.type).toBe("install_hmms");
		// A wide window: the assertion is that the age is measured from the older
		// row and in UTC, not that the clocks agree to the second.
		expect(row?.ageSeconds).toBeGreaterThan(550);
		expect(row?.ageSeconds).toBeLessThan(650);
	});

	it("ignores a claimed task, however old", async () => {
		const taskId = await createTask(db, "install_hmms");

		await db
			.update(tasks)
			.set({ created_at: new Date(Date.now() - 600 * 1000) })
			.where(eq(tasks.id, taskId));

		await holdTask(taskId, RUNNER_A, 10);

		expect(await readOldestQueuedTaskAges(db)).toEqual([]);
	});
});

describe("readTaskQueueBounded", () => {
	it("returns both reads together", async () => {
		await createTask(db, "install_hmms");

		const snapshot = await readTaskQueueBounded(db);

		expect(snapshot.counts).toEqual([
			{ type: "install_hmms", queued: 1, running: 0 },
		]);
		expect(snapshot.oldestQueuedAges).toHaveLength(1);
	});

	// The bound itself is `withTimeout`'s, and `timeout.test.ts` covers it against
	// a promise that genuinely never settles. Asserting it from here meant racing
	// two real queries against a zero deadline — which `setTimeout` clamps to 1 ms,
	// so under load the queries won and the test failed for no reason anyone could
	// act on.
});
