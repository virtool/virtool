import { hashPassword } from "@virtool/data/auth/password";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import {
	getDataMigration,
	listDataMigrationFindings,
} from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts } from "@virtool/data/db/schema/auth";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { DATA_MIGRATIONS } from "./registry";
import { executeDataMigration } from "./run";

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
	await db.delete(dataMigrations);
	await db.delete(users);
});

function runLegacyIdentities() {
	const definition = DATA_MIGRATIONS.legacy_identities;
	if (definition === undefined) {
		throw new Error("legacy identity migration is not registered");
	}

	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		definition,
	);
}

it("migrates eligible users while incomplete users remain a passing report", async () => {
	const eligible = await seedUser(db, {
		handle: "Ada",
		email: " Ada@Example.com ",
		password: await hashPassword("legacy-password"),
	});
	const incomplete = await seedUser(db, { handle: "incomplete", email: "" });

	const finished = await runLegacyIdentities();

	expect(finished).toMatchObject({
		version: 2,
		status: "passed",
		summary: {
			counts: {
				blankEmail: { active: 1, deactivated: 0 },
			},
			credentials: { inserted: 1 },
		},
	});
	expect(await listDataMigrationFindings(db, finished.id)).toHaveLength(0);
	expect(await db.select().from(authAccounts)).toMatchObject([
		{ userId: eligible },
	]);
	expect(
		(await db.select().from(users)).find((user) => user.id === incomplete),
	).toMatchObject({ authMigratedAt: null, email: "" });

	const rerun = await runLegacyIdentities();
	expect(rerun).toMatchObject({
		status: "passed",
		attempts: 2,
		summary: { credentials: { inserted: 0, alreadyPresent: 1 } },
	});
});

it("keeps unsafe identities actionable", async () => {
	const userId = await seedUser(db, {
		handle: "not valid",
		email: "invalid-handle@example.com",
		password: await hashPassword("legacy-password"),
	});

	const finished = await runLegacyIdentities();

	expect(finished.status).toBe("failed");
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{ code: "invalid_handle", subject: `user:${userId}` },
	]);
	expect(await getDataMigration(db, "legacy_identities", 2)).toMatchObject({
		status: "failed",
	});
	expect(await db.select().from(authAccounts)).toHaveLength(0);
});
