import {
	seedSession,
	seedSetupSession,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { settings } from "@virtool/data/db/schema/settings";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
import { createLogger } from "@virtool/logger";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { forcedPasswordReset } from "./bodies/forced-password-reset";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	// The body runs before the migration that adds this constraint.
	await database.client`
		ALTER TABLE public.users DROP CONSTRAINT force_reset_unset
	`;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(users);
	await db.delete(settings);
	await database.client`DELETE FROM public.email_outbox`;
});

function runBackfill() {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		forcedPasswordReset,
	);
}

const OLD_PASSWORD = "$argon2id$old-hash";

type SeedOptions = {
	handle: string;
	email?: string;
	emailVerified?: boolean;
	flagged?: boolean;
	migrated?: boolean;
};

async function seedFlaggedUser({
	handle,
	email = "",
	emailVerified = false,
	flagged = true,
	migrated = false,
}: SeedOptions) {
	const userId = await seedUser(db, {
		handle,
		email,
		password: Buffer.from(OLD_PASSWORD, "utf8"),
		authMigratedAt: migrated ? new Date() : null,
	});
	await database.client`
		UPDATE public.users
		SET force_reset = ${flagged}, email_verified = ${emailVerified}
		WHERE id = ${userId}
	`;

	if (migrated) {
		await database.client`
			INSERT INTO public.auth_accounts
				(account_id, provider_id, user_id, password, created_at, updated_at)
			VALUES
				(${String(userId)}, 'credential', ${userId}, ${OLD_PASSWORD},
					timezone('utc', now()), timezone('utc', now()))
		`;
	}

	await seedSession(db, userId);
	await seedSetupSession(db, userId, "password_recovery");

	return userId;
}

async function getUser(userId: number) {
	const [row] = await database.client<
		{ forceReset: boolean; password: Buffer }[]
	>`
		SELECT force_reset AS "forceReset", password FROM public.users WHERE id = ${userId}
	`;

	if (!row) {
		throw new Error("user missing");
	}

	return {
		forceReset: row.forceReset,
		password: row.password.toString("utf8"),
	};
}

async function getAccountPassword(userId: number) {
	const [row] = await database.client<{ password: string }[]>`
		SELECT password FROM public.auth_accounts WHERE user_id = ${userId}
	`;

	return row?.password;
}

async function countSessions(userId: number) {
	const [sessions, setups] = await Promise.all([
		database.client<{ n: number }[]>`
			SELECT count(*)::int AS n FROM public.auth_sessions WHERE user_id = ${userId}
		`,
		database.client<{ n: number }[]>`
			SELECT count(*)::int AS n FROM public.setup_sessions WHERE user_id = ${userId}
		`,
	]);

	return { auth: sessions[0]?.n, setup: setups[0]?.n };
}

async function listOutbox() {
	return database.client<
		{
			recipient: string;
			status: string;
			template: unknown;
			templateVersion: number;
		}[]
	>`
		SELECT recipient, status, template, template_version AS "templateVersion"
		FROM public.email_outbox ORDER BY id
	`;
}

it("replaces the password of a flagged migrated user and revokes sessions", async () => {
	const userId = await seedFlaggedUser({ handle: "migrated", migrated: true });

	const finished = await runBackfill();

	expect(finished.error).toBeNull();
	expect(finished.status).toBe("passed");
	expect(finished.summary).toMatchObject({ processed: 1, findings: 0 });

	const user = await getUser(userId);
	const accountPassword = await getAccountPassword(userId);

	expect(user.forceReset).toBe(false);
	expect(user.password).toMatch(/^\$argon2id\$/);
	expect(user.password).not.toBe(OLD_PASSWORD);
	expect(accountPassword).toBe(user.password);
	expect(await countSessions(userId)).toEqual({ auth: 0, setup: 0 });
});

it("replaces the password of a flagged legacy user", async () => {
	const userId = await seedFlaggedUser({ handle: "legacy" });

	const finished = await runBackfill();

	expect(finished.status).toBe("passed");
	expect(finished.summary).toMatchObject({ findings: 0 });

	const user = await getUser(userId);

	expect(user.forceReset).toBe(false);
	expect(user.password).toMatch(/^\$argon2id\$/);
	expect(user.password).not.toBe(OLD_PASSWORD);
	expect(await getAccountPassword(userId)).toBeUndefined();
});

it("leaves an unflagged user untouched", async () => {
	const userId = await seedFlaggedUser({
		handle: "calm",
		flagged: false,
		migrated: true,
	});

	const finished = await runBackfill();

	expect(finished.status).toBe("passed");
	expect(finished.summary).toMatchObject({ processed: 0 });
	expect(await getUser(userId)).toEqual({
		forceReset: false,
		password: OLD_PASSWORD,
	});
	expect(await getAccountPassword(userId)).toBe(OLD_PASSWORD);
	expect(await countSessions(userId)).toEqual({ auth: 1, setup: 1 });
});

it("queues one password changed email for a verified address", async () => {
	await seedSettings(db, { emailEnabled: true });
	await seedFlaggedUser({
		handle: "mailed",
		email: "mailed@example.com",
		emailVerified: true,
	});

	await runBackfill();

	const rows = await listOutbox();

	expect(rows).toHaveLength(1);
	expect(rows[0]).toEqual({
		recipient: "mailed@example.com",
		status: "queued",
		template: { type: "password_changed", username: "mailed" },
		templateVersion: 3,
	});
});

it("queues no email for an unverified address", async () => {
	await seedSettings(db, { emailEnabled: true });
	await seedFlaggedUser({
		handle: "unverified",
		email: "unverified@example.com",
		emailVerified: false,
	});

	await runBackfill();

	expect(await listOutbox()).toEqual([]);
});

it("queues no email for an empty address", async () => {
	await seedSettings(db, { emailEnabled: true });
	await seedFlaggedUser({ handle: "blank", emailVerified: true });

	await runBackfill();

	expect(await listOutbox()).toEqual([]);
});

it("queues no email when email is disabled", async () => {
	await seedSettings(db, { emailEnabled: false });
	await seedFlaggedUser({
		handle: "quiet",
		email: "quiet@example.com",
		emailVerified: true,
	});

	await runBackfill();

	expect(await listOutbox()).toEqual([]);
});

it("does not queue a second email when replayed", async () => {
	await seedSettings(db, { emailEnabled: true });
	const userId = await seedFlaggedUser({
		handle: "replayed",
		email: "replayed@example.com",
		emailVerified: true,
	});

	await runBackfill();
	await db.delete(dataMigrations);

	const empty = await runBackfill();

	expect(empty.status).toBe("passed");
	expect(empty.summary).toMatchObject({ processed: 0 });
	expect(await listOutbox()).toHaveLength(1);

	await database.client`UPDATE public.users SET force_reset = true WHERE id = ${userId}`;
	await db.delete(dataMigrations);

	const again = await runBackfill();

	expect(again.error).toBeNull();
	expect(again.status).toBe("passed");
	expect(again.summary).toMatchObject({ processed: 1 });
	expect((await getUser(userId)).forceReset).toBe(false);
	expect(await listOutbox()).toHaveLength(1);
});

it("processes more users than one batch", async () => {
	const ids: number[] = [];

	for (let i = 0; i < 12; i += 1) {
		ids.push(await seedFlaggedUser({ handle: `bulk${i}` }));
	}

	const finished = await runBackfill();

	expect(finished.status).toBe("passed");
	expect(finished.summary).toMatchObject({ processed: 12, batches: 2 });

	const remaining = await database.client<{ n: number }[]>`
		SELECT count(*)::int AS n FROM public.users WHERE force_reset = true
	`;

	expect(remaining[0]?.n).toBe(0);

	for (const id of ids) {
		expect((await getUser(id)).password).toMatch(/^\$argon2id\$/);
	}
}, 60_000);
