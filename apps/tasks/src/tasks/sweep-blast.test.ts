import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { analyses, nuvsBlast } from "@virtool/data/db/schema/analyses";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import type { ClaimedTask } from "@virtool/data/tasks/data";
import { collectFrames } from "@virtool/data/test/frames";
import { createLogger, type Logger } from "@virtool/logger";
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
import { claimTask, readTaskRow } from "../testing/tasks";
import type { TaskContext } from "./registry";
import { sweepBlastTask } from "./sweep-blast";

const logger: Logger = createLogger({ name: "test", level: "silent" });

const SUBMISSION_HTML = "<!--QBlastInfoBegin\n RID = RID001\nQBlastInfoEnd-->";

let database: TestDatabase;
let db: Db;
let ctx: TaskContext;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(nuvsBlast);
	await db.delete(analyses);
	await db.delete(users);
	await db.delete(tasks);

	ctx = { db, storage: new MemoryStorage() };
	userId = await seedUser(db);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

async function seedPendingBlast(): Promise<{
	analysisId: number;
	blastId: number;
}> {
	const now = new Date();

	const [analysis] = await db
		.insert(analyses)
		.values({
			created_at: now,
			updated_at: now,
			workflow: "nuvs",
			ready: true,
			results: { hits: [{ index: 0, sequence: "ATGCATGC", orfs: [] }] },
			sample: "0",
			user_id: userId,
			index_id: 1,
		})
		.returning({ id: analyses.id });

	if (!analysis) {
		throw new Error("failed to seed analysis");
	}

	const [blast] = await db
		.insert(nuvsBlast)
		.values({
			analysis_id: analysis.id,
			sequence_index: 0,
			created_at: now,
			updated_at: now,
			last_checked_at: new Date(Date.now() - 60_000),
			interval: 3,
			ready: false,
		})
		.returning({ id: nuvsBlast.id });

	if (!blast) {
		throw new Error("failed to seed blast");
	}

	return { analysisId: analysis.id, blastId: blast.id };
}

function claim(): Promise<ClaimedTask> {
	return claimTask(db, sweepBlastTask);
}

function run(task: ClaimedTask, signal?: AbortSignal) {
	return runTask({
		db,
		def: sweepBlastTask,
		task,
		ctx,
		logger,
		signal: signal ?? new AbortController().signal,
	});
}

describe("sweepBlastTask", () => {
	it("advances an outstanding search and completes", async () => {
		const { blastId } = await seedPendingBlast();

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(SUBMISSION_HTML, { status: 200 })),
		);

		const task = await claim();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "sweep",
		});

		const [row] = await db
			.select({ rid: nuvsBlast.rid })
			.from(nuvsBlast)
			.where(eq(nuvsBlast.id, blastId));

		expect(row?.rid).toBe("RID001");
	});

	it("completes when there is nothing outstanding", async () => {
		const fetchMock = vi.fn();

		vi.stubGlobal("fetch", fetchMock);

		const task = await claim();

		expect(await run(task)).toEqual({ status: "completed" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	// The panel only moves because the sweep says so, so a run that stored a RID
	// and published nothing is a spinner that never updates.
	it("publishes an analyses frame when a search advances", async () => {
		const { analysisId } = await seedPendingBlast();

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(SUBMISSION_HTML, { status: 200 })),
		);

		const task = await claim();

		const frames = await collectFrames(database.client, async () => {
			await run(task);
		});

		expect(
			frames
				.filter((frame) => frame.domain === "analyses")
				.map((frame) => frame.resource_id),
		).toEqual([analysisId]);
	});

	it("reports aborted and leaves the row alone when the runner drains", async () => {
		const { blastId } = await seedPendingBlast();

		const controller = new AbortController();

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				controller.abort();

				throw Object.assign(new Error("aborted"), { name: "AbortError" });
			}),
		);

		const task = await claim();

		expect(await run(task, controller.signal)).toEqual({ status: "aborted" });

		const [row] = await db
			.select({ rid: nuvsBlast.rid, interval: nuvsBlast.interval })
			.from(nuvsBlast)
			.where(eq(nuvsBlast.id, blastId));

		expect(row).toEqual({ rid: null, interval: 3 });
	});
});
