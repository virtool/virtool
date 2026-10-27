import { listDataMigrationFindings } from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { legacySamples } from "@virtool/data/db/schema/samples";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { sampleNameUniqueness } from "./bodies/sample-name-uniqueness";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	await database.client`
		ALTER TABLE public.legacy_samples
		DROP CONSTRAINT legacy_samples_name_key
	`;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(legacySamples);
});

function runAudit() {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		sampleNameUniqueness,
	);
}

function sample(name: string) {
	return {
		name,
		library_type: "normal",
		created_at: new Date(),
	};
}

it("passes when every sample name is unique", async () => {
	await db.insert(legacySamples).values([sample("first"), sample("second")]);

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "passed",
		summary: { duplicateNames: 0 },
	});
});

it("reports every sample name used more than once", async () => {
	await db
		.insert(legacySamples)
		.values([sample("same"), sample("other"), sample("same")]);

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "failed",
		summary: { duplicateNames: 1 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{
			code: "duplicate_sample_name",
			subject: "sample-name:same",
			detail: { count: 2 },
		},
	]);
});
