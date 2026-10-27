import { seedUser } from "@virtool/data/auth/test/fixtures";
import { listDataMigrationFindings } from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedGroup } from "@virtool/data/groups/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { primaryGroupUniqueness } from "./bodies/primary-group-uniqueness";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	await database.client`DROP INDEX public.primary_group_unique`;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(groups);
});

function runAudit() {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		primaryGroupUniqueness,
	);
}

it("passes when every user has at most one primary group", async () => {
	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "passed",
		summary: { usersWithMultiplePrimaryGroups: 0 },
	});
});

it("reports every user assigned to multiple primary groups", async () => {
	const userId = await seedUser(db);
	const inserted = [
		await seedGroup(db, { name: "first" }),
		await seedGroup(db, { name: "second" }),
	];
	await db
		.insert(userGroups)
		.values(inserted.map((groupId) => ({ groupId, userId, primary: true })));

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "failed",
		summary: { usersWithMultiplePrimaryGroups: 1 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{
			code: "multiple_primary_groups",
			subject: `user:${userId}`,
			detail: { count: 2 },
		},
	]);
});
