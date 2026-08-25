import type { JobState } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { claimTask, readTaskRow } from "../testing/tasks";
import type { TaskContext } from "./registry";
import { timeoutJobsTask } from "./timeout-jobs";

const logger: Logger = createLogger({ name: "test", level: "silent" });

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
	await db.delete(jobs);
	await db.delete(users);
	await db.delete(tasks);

	ctx = { db, storage: new MemoryStorage() };
	userId = await seedUser(db);
});

/** Insert a job last pinged `pingAgeSeconds` ago. */
async function seedJob(
	state: JobState,
	pingAgeSeconds: number,
): Promise<number> {
	const [job] = await db
		.insert(jobs)
		.values({
			created_at: new Date(Date.now() - 3600 * 1000),
			pinged_at: new Date(Date.now() - pingAgeSeconds * 1000),
			state,
			user_id: userId,
			workflow: "nuvs",
		})
		.returning({ id: jobs.id });

	if (!job) {
		throw new Error("failed to seed job");
	}

	return job.id;
}

function claim(): Promise<ClaimedTask> {
	return claimTask(db, timeoutJobsTask);
}

function run(task: ClaimedTask) {
	return runTask({
		db,
		def: timeoutJobsTask,
		task,
		ctx,
		logger,
		signal: new AbortController().signal,
	});
}

function readJobState(jobId: number) {
	return db
		.select({ state: jobs.state, finishedAt: jobs.finished_at })
		.from(jobs)
		.where(eq(jobs.id, jobId))
		.then(([row]) => row);
}

describe("timeoutJobsTask", () => {
	it("fails the stalled jobs and completes", async () => {
		// The body passes no threshold, so this is the real five minutes.
		const stale = await seedJob("running", 600);
		const fresh = await seedJob("running", 60);

		const task = await claim();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "timeout_jobs",
		});

		expect(await readJobState(stale)).toMatchObject({ state: "failed" });
		expect(await readJobState(fresh)).toMatchObject({
			state: "running",
			finishedAt: null,
		});
	});

	it("completes without failing anything when no job has stalled", async () => {
		const fresh = await seedJob("running", 60);

		const task = await claim();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
		});

		expect(await readJobState(fresh)).toMatchObject({ state: "running" });
	});

	// End to end, so the `tasks` frames the framework writes are in the stream
	// alongside them. Only the `jobs` half is this body's concern.
	it("publishes a jobs frame per timed-out id", async () => {
		const first = await seedJob("running", 600);
		const second = await seedJob("running", 600);

		const task = await claim();

		const frames = await collectFrames(database.client, async () => {
			await run(task);
		});

		expect(
			frames
				.filter((frame) => frame.domain === "jobs")
				.map((frame) => frame.resource_id)
				.sort((a, b) => (a as number) - (b as number)),
		).toEqual([first, second]);
	});
});
