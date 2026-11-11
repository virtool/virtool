import { seedUser } from "@virtool/data/auth/test/fixtures";
import { listDataMigrationFindings } from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { usernameBackfill } from "./bodies/username-backfill";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	// The body runs before 0052, so lift the constraints that 0052 adds.
	await database.client`
		ALTER TABLE public.users
		DROP CONSTRAINT username_lowercase,
		DROP CONSTRAINT username_matches_lifecycle_state
	`;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(users);
});

function runAudit() {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		usernameBackfill,
	);
}

async function seedLegacyUser({
	handle,
	username,
	pending = false,
}: {
	handle: string;
	username: string | null;
	pending?: boolean;
}): Promise<number> {
	const id = await seedUser(db, {
		lifecycleState: pending ? "pending" : "normal",
		username: `seed_${handle.toLowerCase().replace(/[^a-z]/g, "")}`,
	});
	await database.client`
		UPDATE public.users
		SET handle = ${handle}, username = ${username}
		WHERE id = ${id}
	`;
	return id;
}

async function listUsernames() {
	const rows = await database.client<{ id: number; username: string | null }[]>`
		SELECT id, username FROM public.users ORDER BY id
	`;
	return rows.map(({ id, username }) => ({ id, username }));
}

it("folds handles into lowercase usernames and clears pending ones", async () => {
	const alice = await seedLegacyUser({ handle: "Alice", username: null });
	const bob = await seedLegacyUser({ handle: "bob", username: "bob" });
	const carol = await seedLegacyUser({ handle: "Carol", username: "carol" });
	const pending = await seedLegacyUser({
		handle: "",
		username: null,
		pending: true,
	});

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "passed",
		summary: { findings: 0, backfilled: 1 },
	});
	expect(await listUsernames()).toEqual([
		{ id: alice, username: "alice" },
		{ id: bob, username: "bob" },
		{ id: carol, username: "carol" },
		{ id: pending, username: null },
	]);
});

it("reports a handle that does not fold to a valid username and writes nothing", async () => {
	const invalid = await seedLegacyUser({ handle: "Not Valid", username: null });
	const valid = await seedLegacyUser({ handle: "Alice", username: null });

	const finished = await runAudit();

	expect(finished).toMatchObject({
		status: "failed",
		summary: { findings: 1, backfilled: 0 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{ code: "invalid_username", subject: `user:${invalid}` },
	]);
	expect(await listUsernames()).toEqual([
		{ id: invalid, username: null },
		{ id: valid, username: null },
	]);
});

it("reports a pending account that has a handle", async () => {
	const pending = await seedLegacyUser({
		handle: "invitee",
		username: null,
		pending: true,
	});

	const finished = await runAudit();

	expect(finished).toMatchObject({
		status: "failed",
		summary: { findings: 1, backfilled: 0 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{ code: "pending_has_handle", subject: `user:${pending}` },
	]);
});

it("reports a username that differs from the folded handle", async () => {
	const mismatched = await seedLegacyUser({ handle: "Ada", username: "other" });

	const finished = await runAudit();

	expect(finished).toMatchObject({
		status: "failed",
		summary: { findings: 1, backfilled: 0 },
	});
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{ code: "username_mismatch", subject: `user:${mismatched}` },
	]);
	expect(await listUsernames()).toEqual([
		{ id: mismatched, username: "other" },
	]);
});
