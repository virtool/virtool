import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { totpEnrollmentSetupState } from "./bodies/totp-enrollment-setup-state";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	await database.client`
		ALTER TABLE public.setup_sessions DROP CONSTRAINT setup_sessions_purpose_valid
	`;
	await database.client`
		ALTER TABLE public.setup_tokens DROP CONSTRAINT setup_tokens_purpose_valid
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
		totpEnrollmentSetupState,
	);
}

async function seedSetupState(userId: number, purpose: string) {
	const expiresAt = new Date(Date.now() + 60_000).toISOString();
	await database.client`
		INSERT INTO public.setup_tokens (user_id, purpose, token_hash, expires_at)
		VALUES (${userId}, ${purpose}, ${`token-${purpose}`}, ${expiresAt})
	`;
	await database.client`
		INSERT INTO public.setup_sessions
			(session_id, token_hash, user_id, purpose, ip, expires_at)
		VALUES
			(${`session-${purpose}`}, ${`hash-${purpose}`}, ${userId}, ${purpose}, '127.0.0.1', ${expiresAt})
	`;
}

async function listPurposes() {
	const [sessions, tokens] = await Promise.all([
		database.client<{ purpose: string }[]>`
			SELECT purpose FROM public.setup_sessions ORDER BY purpose
		`,
		database.client<{ purpose: string }[]>`
			SELECT purpose FROM public.setup_tokens ORDER BY purpose
		`,
	]);

	return {
		sessions: sessions.map((row) => row.purpose),
		tokens: tokens.map((row) => row.purpose),
	};
}

it("deletes totp enrollment setup state and keeps other purposes", async () => {
	const userId = await seedUser(db);
	await seedSetupState(userId, "totp_enrollment");
	await seedSetupState(userId, "email_remediation");

	const finished = await runAudit();

	expect(finished.error).toBeNull();
	expect(finished).toMatchObject({
		status: "passed",
		summary: { setupSessionsDeleted: 1, setupTokensDeleted: 1 },
	});
	expect(await listPurposes()).toEqual({
		sessions: ["email_remediation"],
		tokens: ["email_remediation"],
	});
});

it("passes when there is no totp enrollment setup state", async () => {
	const finished = await runAudit();

	expect(finished).toMatchObject({
		status: "passed",
		summary: { setupSessionsDeleted: 0, setupTokensDeleted: 0 },
	});
});
