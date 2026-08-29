import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { StoredJobClaim } from "@virtool/contracts";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db } from "./pg";
import { takeFirstOrThrow } from "./rows";
import { analyses } from "./schema/analyses";
import { indexes } from "./schema/indexes";
import { jobs } from "./schema/jobs";
import { legacyReferences } from "./schema/references";
import { users } from "./schema/users";
import { createTestDatabase, type TestDatabase } from "./test/fixtures";

const MIGRATION_SQL = fileURLToPath(
	new URL(
		"../../drizzle/0018_backfill_analyses_workflow_version.sql",
		import.meta.url,
	),
);

let database: TestDatabase;
let db: Db;
let userId: number;
let indexId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(analyses);
	await db.delete(indexes);
	await db.delete(jobs);
	await db.delete(legacyReferences);
	await db.delete(users);

	userId = await seedUser(db);
	const referenceId = takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({ name: "Reference", user_id: userId })
			.returning({ id: legacyReferences.id }),
	).id;
	indexId = takeFirstOrThrow(
		await db
			.insert(indexes)
			.values({
				created_at: new Date(),
				manifest: {},
				ready: true,
				reference_id: referenceId,
				user_id: userId,
				version: 0,
			})
			.returning({ id: indexes.id }),
	).id;
});

async function applyBackfill(): Promise<void> {
	await database.client.unsafe(await readFile(MIGRATION_SQL, "utf8"));
}

function claim(workflowVersion: string): StoredJobClaim {
	return {
		runner_id: "runner",
		mem: 8,
		cpu: 2,
		image: "virtool/nuvs:1.0.0",
		runtime_version: "1.0.0",
		workflow_version: workflowVersion,
	};
}

async function seedJob(
	overrides: Partial<typeof jobs.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(jobs)
			.values({
				created_at: new Date(),
				state: "succeeded",
				user_id: userId,
				workflow: "nuvs",
				...overrides,
			})
			.returning({ id: jobs.id }),
	).id;
}

async function seedAnalysis(
	overrides: Partial<typeof analyses.$inferInsert> = {},
): Promise<number> {
	const now = new Date();

	return takeFirstOrThrow(
		await db
			.insert(analyses)
			.values({
				created_at: now,
				updated_at: now,
				workflow: "nuvs",
				ready: true,
				index_id: indexId,
				user_id: userId,
				...overrides,
			})
			.returning({ id: analyses.id }),
	).id;
}

async function getVersion(analysisId: number): Promise<string | null> {
	return takeFirstOrThrow(
		await db
			.select({ version: analyses.workflow_version })
			.from(analyses)
			.where(eq(analyses.id, analysisId)),
	).version;
}

it("copies the claim version onto a finalized analysis with a null version", async () => {
	const jobId = await seedJob({ claim: claim("3.2.1") });
	const analysisId = await seedAnalysis({ job_id: jobId });

	await applyBackfill();

	expect(await getVersion(analysisId)).toBe("3.2.1");
});

it("carries an UNKNOWN claim version across as recorded provenance", async () => {
	const jobId = await seedJob({ claim: claim("UNKNOWN") });
	const analysisId = await seedAnalysis({ job_id: jobId });

	await applyBackfill();

	expect(await getVersion(analysisId)).toBe("UNKNOWN");
});

it("leaves an already-recorded version untouched", async () => {
	const jobId = await seedJob({ claim: claim("3.2.1") });
	const analysisId = await seedAnalysis({
		job_id: jobId,
		workflow_version: "9.9.9",
	});

	await applyBackfill();

	expect(await getVersion(analysisId)).toBe("9.9.9");
});

it("leaves an unfinalized analysis null even when its claim has a version", async () => {
	const jobId = await seedJob({ claim: claim("3.2.1") });
	const analysisId = await seedAnalysis({ job_id: jobId, ready: false });

	await applyBackfill();

	expect(await getVersion(analysisId)).toBeNull();
});

it("leaves the version null when the job has no claim", async () => {
	const jobId = await seedJob({ claim: null });
	const analysisId = await seedAnalysis({ job_id: jobId });

	await applyBackfill();

	expect(await getVersion(analysisId)).toBeNull();
});

it("leaves the version null when the analysis has no job", async () => {
	const analysisId = await seedAnalysis({ job_id: null });

	await applyBackfill();

	expect(await getVersion(analysisId)).toBeNull();
});

it("updates nothing on a re-run", async () => {
	const jobId = await seedJob({ claim: claim("3.2.1") });
	const analysisId = await seedAnalysis({ job_id: jobId });

	await applyBackfill();
	expect(await getVersion(analysisId)).toBe("3.2.1");

	await applyBackfill();
	expect(await getVersion(analysisId)).toBe("3.2.1");
});
