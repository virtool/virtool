import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { Db } from "./pg";
import { takeFirstOrThrow } from "./rows";
import { users } from "./schema/users";
import { createTestDatabase, type TestDatabase } from "./test/fixtures";

const MIGRATION_SQL = fileURLToPath(
	new URL("../../drizzle/0049_add_changelog_watermark.sql", import.meta.url),
);

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

it("gives an existing user a watermark at the time of the migration", async () => {
	await database.client.unsafe(
		`ALTER TABLE users DROP COLUMN last_seen_changelog_at`,
	);

	const [row] = await database.client.unsafe(
		`INSERT INTO users (active, email, username, last_password_change, settings)
		 VALUES (true, '', 'alice', '2020-01-01', '{}')
		 RETURNING id`,
	);

	const before = Date.now();
	await database.client.unsafe(await readFile(MIGRATION_SQL, "utf8"));

	const { lastSeenChangelogAt } = takeFirstOrThrow(
		await db
			.select({ lastSeenChangelogAt: users.lastSeenChangelogAt })
			.from(users)
			.where(eq(users.id, row.id)),
	);

	expect(lastSeenChangelogAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
	expect(lastSeenChangelogAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
});
