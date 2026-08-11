import type { Db } from "@virtool/data/db/pg";
import { HMM_STATUS_ID, legacyHmmStatus } from "@virtool/data/db/schema/hmms";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { acquireTask, type ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { runTask } from "../framework/run";
import { collectFrames } from "../testing/frames";
import { refreshHmmsTask } from "./refresh-hmms";
import type { TaskContext } from "./registry";

const RUNNER = "ts-runner-a-1";

const logger: Logger = createLogger({ name: "test", level: "silent" });

const manifestRelease = {
	body: "notes",
	content_type: "application/gzip",
	download_url: "https://www.virtool.ca/hmm.tar.gz",
	filename: "hmm.tar.gz",
	html_url: "https://github.com/virtool/virtool-hmm/releases/v2.0.0",
	id: 45,
	name: "v2.0.0",
	published_at: "2026-01-01T00:00:00Z",
	size: 1024,
};

let database: TestDatabase;
let db: Db;
let storage: StorageBackend;
let ctx: TaskContext;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	storage = new MemoryStorage();
	ctx = { db, storage };
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyHmmStatus);
	await db.delete(tasks);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Answer the manifest fetch with `body` under `status`. */
function stubFetch(status: number, body: unknown): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify(body), { status })),
	);
}

/**
 * Insert a `refresh_hmms` row and claim it, as the spawner and the runner will.
 *
 * The row is written directly rather than through `createTask`, whose `TaskType`
 * lists only the four the web app spawns. A periodic task is the spawner's, and
 * that half is not built yet.
 */
async function claim(): Promise<ClaimedTask> {
	await db.insert(tasks).values({
		complete: false,
		context: {},
		count: 0,
		created_at: new Date(),
		progress: 0,
		step: refreshHmmsTask.type,
		type: refreshHmmsTask.type,
	});

	const claimed = await acquireTask(db, {
		runnerId: RUNNER,
		allowedTypes: [refreshHmmsTask.type],
	});

	if (claimed === null) {
		throw new Error("the task under test was not claimable");
	}

	return claimed;
}

function readRow(taskId: number) {
	return db
		.select()
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.then(([row]) => row);
}

describe("refreshHmmsTask", () => {
	it("runs a claimed task through to complete and stores the release", async () => {
		stubFetch(200, { "virtool-hmm": [manifestRelease] });

		const task = await claim();

		const frames = await collectFrames(database.client, async () => {
			const outcome = await runTask({
				db,
				def: refreshHmmsTask,
				task,
				ctx,
				logger,
				signal: new AbortController().signal,
			});

			expect(outcome).toEqual({ status: "completed" });
		});

		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "refresh",
		});

		const [status] = await db
			.select()
			.from(legacyHmmStatus)
			.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

		expect(status?.release).toMatchObject({ id: 45, name: "v2.0.0" });

		// The step entry and the completion. The body reports nothing between
		// them, so a third frame would mean a write this task has no reason to
		// make.
		expect(frames).toEqual(
			Array.from({ length: 2 }, () => ({
				domain: "tasks",
				resource_id: task.id,
				operation: "update",
			})),
		);
	});

	it("fails the task and records the reason when virtool.ca cannot be reached", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
		);

		const task = await claim();

		const outcome = await runTask({
			db,
			def: refreshHmmsTask,
			task,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		expect(outcome).toEqual({
			status: "failed",
			error: "HmmReleaseError: Could not reach Virtool.ca",
		});

		expect(await readRow(task.id)).toMatchObject({
			complete: true,
			error: "HmmReleaseError: Could not reach Virtool.ca",
		});

		const [status] = await db
			.select()
			.from(legacyHmmStatus)
			.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

		expect(status?.errors).toEqual(["Could not reach Virtool.ca"]);
	});

	// Nothing interrupts a body on its own: `runTask` awaits it. A fetch left to
	// run its own deadline out would hold the drain open for ten seconds and
	// could reach the status upsert after the claim was released.
	it("abandons the fetch when the run is aborted", async () => {
		const controller = new AbortController();

		// The already-aborted check is not redundant: `addEventListener("abort")`
		// never fires on a signal that aborted before it was attached.
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init?: { signal?: AbortSignal }) =>
					new Promise<Response>((_resolve, reject) => {
						const signal = init?.signal;

						if (signal?.aborted) {
							reject(signal.reason);
							return;
						}

						signal?.addEventListener("abort", () => {
							reject(signal.reason);
						});
					}),
			),
		);

		const task = await claim();

		const run = runTask({
			db,
			def: refreshHmmsTask,
			task,
			ctx,
			logger,
			signal: controller.signal,
		});

		controller.abort();

		// Left claimed and incomplete for the runner to release, not failed — the
		// task never got its answer, and burning it over a shutdown would cost the
		// next spawn's refresh for nothing.
		expect(await run).toEqual({ status: "aborted" });

		expect(await readRow(task.id)).toMatchObject({
			complete: false,
			error: null,
		});

		expect(await db.select().from(legacyHmmStatus)).toEqual([]);
	});

	// A reclaimed task re-runs from step zero, so the second attempt must leave
	// what the first left rather than compounding it.
	it("is idempotent across a re-run", async () => {
		stubFetch(200, { "virtool-hmm": [manifestRelease] });

		const first = await claim();

		await runTask({
			db,
			def: refreshHmmsTask,
			task: first,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		const [afterFirst] = await db.select().from(legacyHmmStatus);

		const second = await claim();

		await runTask({
			db,
			def: refreshHmmsTask,
			task: second,
			ctx,
			logger,
			signal: new AbortController().signal,
		});

		const rows = await db.select().from(legacyHmmStatus);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.release).toMatchObject({
			id: afterFirst?.release?.id,
			name: afterFirst?.release?.name,
			newer: afterFirst?.release?.newer,
		});
		expect(rows[0]?.updates).toEqual(afterFirst?.updates);
	});
});
