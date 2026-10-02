import { seedUser } from "@virtool/data/auth/test/fixtures";
import { listDataMigrationFindings } from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { authPasskeys } from "@virtool/data/db/schema/auth";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { passkeyCredentialUniqueness } from "./bodies/passkey-credential-uniqueness";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	await database.client`
		ALTER TABLE public.auth_passkeys
		DROP CONSTRAINT auth_passkeys_credential_id_key
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
		passkeyCredentialUniqueness,
	);
}

function passkey(userId: number, credentialID: string) {
	return {
		userId,
		credentialID,
		publicKey: "public-key",
		counter: 0,
		deviceType: "multiDevice",
		backedUp: true,
	};
}

it("passes when every credential id is unique", async () => {
	const userId = await seedUser(db);
	await db
		.insert(authPasskeys)
		.values([passkey(userId, "first"), passkey(userId, "second")]);

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "passed",
		summary: { duplicateCredentials: 0 },
	});
});

it("reports duplicate credential ids by row without naming the credential", async () => {
	const alice = await seedUser(db, { handle: "alice" });
	const bob = await seedUser(db, { handle: "bob" });
	const [first, , second] = await db
		.insert(authPasskeys)
		.values([
			passkey(alice, "shared"),
			passkey(alice, "other"),
			passkey(bob, "shared"),
		])
		.returning({ id: authPasskeys.id });

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "failed",
		summary: { duplicateCredentials: 1 },
	});
	const findings = await listDataMigrationFindings(db, finished.id);
	expect(findings).toMatchObject([
		{
			code: "duplicate_passkey_credential",
			subject: `passkey:${first?.id}`,
			detail: { passkeyIds: [first?.id, second?.id] },
		},
	]);
	expect(JSON.stringify(findings)).not.toContain("shared");
});
