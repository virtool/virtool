import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { eq, isNull } from "drizzle-orm";
import { beforeEach, expect, it, onTestFinished } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import { seedReference } from "../indexes/test/fixtures";
import type { Db } from "./pg";
import { takeFirstOrThrow } from "./rows";
import { indexes } from "./schema/indexes";
import { jobs } from "./schema/jobs";
import { tasks } from "./schema/tasks";
import { createTestDatabase, type TestDatabase } from "./test/fixtures";

const MIGRATION_SQL = fileURLToPath(
	new URL(
		"../../drizzle/0013_backfill_orphaned_index_jobs.sql",
		import.meta.url,
	),
);

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database = await createTestDatabase();
	db = database.db;
	onTestFinished(database.drop);
});

async function applyBackfill(): Promise<void> {
	await database.client.unsafe(await readFile(MIGRATION_SQL, "utf8"));
}

async function seedIndex(
	referenceId: number,
	userId: number,
	{
		version,
		createdAt,
		jobId = null,
		taskId = null,
	}: {
		version: number;
		createdAt: Date;
		jobId?: number | null;
		taskId?: number | null;
	},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(indexes)
			.values({
				version,
				created_at: createdAt,
				manifest: {},
				ready: true,
				reference_id: referenceId,
				user_id: userId,
				job_id: jobId,
				task_id: taskId,
			})
			.returning({ id: indexes.id }),
	).id;
}

async function seedTask(): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(tasks)
			.values({
				complete: false,
				context: {},
				count: 0,
				created_at: new Date(),
				progress: 0,
				step: "build_index",
				type: "create_index",
			})
			.returning({ id: tasks.id }),
	).id;
}

it("reconstructs a build_index job for each orphaned index and links it", async () => {
	const userId = await seedUser(db);
	const referenceId = await seedReference(db, userId);

	const createdAt = new Date("2019-05-01T00:00:00.000Z");
	const orphanA = await seedIndex(referenceId, userId, {
		version: 0,
		createdAt,
	});
	const orphanB = await seedIndex(referenceId, userId, {
		version: 1,
		createdAt: new Date("2020-06-02T00:00:00.000Z"),
	});

	await applyBackfill();

	for (const [indexId, when] of [
		[orphanA, createdAt],
		[orphanB, new Date("2020-06-02T00:00:00.000Z")],
	] as const) {
		const row = takeFirstOrThrow(
			await db.select().from(indexes).where(eq(indexes.id, indexId)),
		);
		expect(row.job_id).not.toBeNull();
		expect(row.task_id).toBeNull();

		const job = takeFirstOrThrow(
			await db
				.select()
				.from(jobs)
				.where(eq(jobs.id, row.job_id as number)),
		);
		expect(job.workflow).toBe("build_index");
		expect(job.state).toBe("succeeded");
		expect(job.user_id).toBe(userId);
		expect(job.created_at).toEqual(when);
		expect(job.finished_at).toEqual(when);
		expect(job.legacy_id).toBeNull();
	}

	// Each orphan gets its own job.
	expect(new Set([orphanA, orphanB]).size).toBe(2);
	const jobIds = await db.select({ id: indexes.job_id }).from(indexes);
	expect(new Set(jobIds.map((r) => r.id)).size).toBe(2);
});

it("leaves job- and task-backed builds untouched", async () => {
	const userId = await seedUser(db);
	const referenceId = await seedReference(db, userId);

	const existingJobId = takeFirstOrThrow(
		await db
			.insert(jobs)
			.values({
				created_at: new Date(),
				state: "succeeded",
				user_id: userId,
				workflow: "build_index",
			})
			.returning({ id: jobs.id }),
	).id;

	const jobBacked = await seedIndex(referenceId, userId, {
		version: 0,
		createdAt: new Date(),
		jobId: existingJobId,
	});
	const taskBacked = await seedIndex(referenceId, userId, {
		version: 1,
		createdAt: new Date(),
		taskId: await seedTask(),
	});

	const jobCountBefore = (await db.select().from(jobs)).length;

	await applyBackfill();

	expect(
		takeFirstOrThrow(
			await db.select().from(indexes).where(eq(indexes.id, jobBacked)),
		).job_id,
	).toBe(existingJobId);
	const taskRow = takeFirstOrThrow(
		await db.select().from(indexes).where(eq(indexes.id, taskBacked)),
	);
	expect(taskRow.job_id).toBeNull();
	expect(taskRow.task_id).not.toBeNull();

	expect((await db.select().from(jobs)).length).toBe(jobCountBefore);
});

it("inserts nothing on a re-run", async () => {
	const userId = await seedUser(db);
	const referenceId = await seedReference(db, userId);
	await seedIndex(referenceId, userId, { version: 0, createdAt: new Date() });

	await applyBackfill();
	const afterFirst = (await db.select().from(jobs)).length;
	expect(afterFirst).toBe(1);

	await applyBackfill();
	expect((await db.select().from(jobs)).length).toBe(afterFirst);
	expect(
		(await db.select().from(indexes).where(isNull(indexes.job_id))).length,
	).toBe(0);
});
