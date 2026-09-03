import { and, eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
} from "vitest";

import type { Db } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import { changePassword, updateUser } from "../users/data";
import { CREDENTIAL_PROVIDER_ID } from "./credential";
import {
	type IdentityClassification,
	type IdentityReport,
	runIdentityMigration,
} from "./migration";
import { hashPassword } from "./password";
import { seedUser } from "./test/fixtures";

/**
 * A `$2b$12$` hash of the password below, written as a literal rather than
 * produced by `hashPassword`, so the tests prove the migration carries *stored*
 * bytes across rather than bytes it just made.
 */
const LEGACY_HASH =
	"$2b$12$YZZHj6hv6jXthfSY0zt8oO0Sk47cjiLCTP.sQHRBYQJVJZ0ALjsxu";

const LEGACY_PASSWORD = "correct-horse-battery-staple";

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
	await db.delete(users);
});

function legacyPassword(): Buffer {
	return Buffer.from(LEGACY_HASH, "utf8");
}

async function audit(): Promise<IdentityReport> {
	return runIdentityMigration(db, testLogger, { mode: "audit" });
}

async function apply(batchSize?: number): Promise<IdentityReport> {
	return runIdentityMigration(db, testLogger, { mode: "apply", batchSize });
}

function classificationOf(
	report: IdentityReport,
	userId: number,
): IdentityClassification | undefined {
	return report.rows.find((row) => row.userId === userId)?.classification;
}

async function readCredentials(userId: number) {
	return db.select().from(authAccounts).where(eq(authAccounts.userId, userId));
}

async function readUser(userId: number) {
	const [row] = await db.select().from(users).where(eq(users.id, userId));
	return row;
}

describe("classification", () => {
	it("splits a blank email by activation state", async () => {
		const active = await seedUser(db, { handle: "alice", email: "" });
		const deactivated = await seedUser(db, {
			handle: "bob",
			email: "   ",
			active: false,
		});

		const report = await audit();

		expect(report.counts.blankEmail).toEqual({ active: 1, deactivated: 1 });
		expect(classificationOf(report, active)).toBe("blankEmail");
		expect(classificationOf(report, deactivated)).toBe("blankEmail");
	});

	it("reports a malformed email without repeating its value", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@invalid",
		});

		const report = await audit();

		expect(report.counts.invalidEmail).toEqual({ active: 1, deactivated: 0 });

		const row = report.rows.find((candidate) => candidate.userId === userId);

		expect(row).toEqual({
			userId,
			handle: "alice",
			active: true,
			classification: "invalidEmail",
		});
	});

	it("withholds every member of a normalized-email collision", async () => {
		const first = await seedUser(db, {
			handle: "alice",
			email: "Shared@Example.com",
			password: legacyPassword(),
		});
		const second = await seedUser(db, {
			handle: "bob",
			email: "  shared@example.com ",
			password: legacyPassword(),
		});
		const third = await seedUser(db, {
			handle: "carol",
			email: "SHARED@EXAMPLE.COM",
			password: legacyPassword(),
			active: false,
		});

		const report = await apply();

		expect(report.counts.duplicateEmail).toEqual({ active: 2, deactivated: 1 });
		expect(report.counts.eligible).toEqual({ active: 0, deactivated: 0 });
		expect(report.duplicateGroups).toEqual([
			{
				normalizedEmail: "shared@example.com",
				userIds: [first, second, third].sort((a, b) => a - b),
			},
		]);

		for (const userId of [first, second, third]) {
			expect(await readCredentials(userId)).toHaveLength(0);
			expect((await readUser(userId))?.authMigratedAt).toBeNull();
		}
	});

	it("reports a password that is not a bcrypt hash", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: Buffer.from([0xff, 0xfe, 0x00, 0x01]),
		});

		const report = await apply();

		expect(report.counts.invalidPassword).toEqual({
			active: 1,
			deactivated: 0,
		});
		expect(classificationOf(report, userId)).toBe("invalidPassword");
		expect(await readCredentials(userId)).toHaveLength(0);
	});
});

describe("audit", () => {
	it("writes nothing", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "  Alice@Example.com ",
			password: legacyPassword(),
		});

		const report = await audit();

		expect(report.mode).toBe("audit");
		expect(report.counts.eligible).toEqual({ active: 1, deactivated: 0 });
		expect(report.credentials.planned).toBe(1);
		expect(report.credentials.inserted).toBe(0);

		const user = await readUser(userId);

		expect(user?.email).toBe("  Alice@Example.com ");
		expect(user?.username).toBeNull();
		expect(user?.authMigratedAt).toBeNull();
		expect(await readCredentials(userId)).toHaveLength(0);
	});

	it("reports the same content on a rerun", async () => {
		await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});
		await seedUser(db, { handle: "bob", email: "" });

		const first = await audit();
		const second = await audit();

		expect({ ...second, generatedAt: first.generatedAt }).toEqual(first);
	});

	it("names no password hash anywhere in the report", async () => {
		await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		const report = await apply();

		expect(JSON.stringify(report)).not.toContain("$2b$");
		expect(JSON.stringify(report)).not.toContain(LEGACY_HASH);
	});
});

describe("apply", () => {
	it("migrates an eligible user and copies the hash verbatim", async () => {
		const userId = await seedUser(db, {
			handle: "Alice",
			email: "  Alice@Example.com ",
			password: legacyPassword(),
		});

		const report = await apply();

		expect(report.credentials).toMatchObject({ planned: 1, inserted: 1 });

		const user = await readUser(userId);

		expect(user?.email).toBe("alice@example.com");
		expect(user?.username).toBe("alice");
		expect(user?.displayUsername).toBe("Alice");
		expect(user?.handle).toBe("Alice");
		expect(user?.authMigratedAt).toBeInstanceOf(Date);
		// The legacy column is not touched: the legacy login path stays
		// authoritative until the boundary cutover.
		expect(user?.password.toString("utf8")).toBe(LEGACY_HASH);

		const [credential] = await readCredentials(userId);

		expect(credential).toMatchObject({
			accountId: String(userId),
			providerId: CREDENTIAL_PROVIDER_ID,
			userId,
			password: LEGACY_HASH,
		});
	});

	it("writes nothing on a rerun over a migrated user", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await apply();

		const [before] = await readCredentials(userId);
		const migratedAt = (await readUser(userId))?.authMigratedAt;

		const report = await apply();

		expect(report.counts.migrated).toEqual({ active: 1, deactivated: 0 });
		expect(report.credentials).toMatchObject({
			planned: 0,
			inserted: 0,
			alreadyPresent: 1,
			updated: 0,
		});

		const [after] = await readCredentials(userId);

		expect(after).toEqual(before);
		expect((await readUser(userId))?.authMigratedAt).toEqual(migratedAt);
	});

	it("resumes over users a partial run left behind", async () => {
		const first = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await apply(1);

		const migratedAt = (await readUser(first))?.authMigratedAt;

		const second = await seedUser(db, {
			handle: "bob",
			email: "bob@example.com",
			password: legacyPassword(),
		});
		const third = await seedUser(db, {
			handle: "carol",
			email: "carol@example.com",
			password: legacyPassword(),
		});

		const report = await apply(1);

		expect(report.credentials).toMatchObject({
			planned: 2,
			inserted: 2,
			alreadyPresent: 1,
		});
		expect((await readUser(first))?.authMigratedAt).toEqual(migratedAt);
		expect(await readCredentials(second)).toHaveLength(1);
		expect(await readCredentials(third)).toHaveLength(1);
	});

	it("creates one credential account under concurrent runs", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		const other = database.connect();
		onTestFinished(other.close);

		const [first, second] = await Promise.all([
			apply(),
			runIdentityMigration(other.db, testLogger, { mode: "apply" }),
		]);

		expect(await readCredentials(userId)).toHaveLength(1);
		expect(first.credentials.inserted + second.credentials.inserted).toBe(1);
		expect(first.credentials.conflicting + second.credentials.conflicting).toBe(
			0,
		);
	});

	it("leaves an incomplete user with no address and no credential", async () => {
		const userId = await seedUser(db, { handle: "alice", email: "" });

		await apply();

		const user = await readUser(userId);

		expect(user?.email).toBe("");
		expect(user?.username).toBeNull();
		expect(user?.authMigratedAt).toBeNull();
		expect(user?.active).toBe(true);
		expect(await readCredentials(userId)).toHaveLength(0);
	});
});

describe("conflicts", () => {
	it("reports a credential linked to another user and changes nothing", async () => {
		const alice = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});
		const bob = await seedUser(db, {
			handle: "bob",
			email: "bob@example.com",
			password: legacyPassword(),
		});

		// Bob's credential claims Alice's account id, which is the pair the
		// migration would mint for her.
		await db.insert(authAccounts).values({
			accountId: String(alice),
			providerId: CREDENTIAL_PROVIDER_ID,
			userId: bob,
			password: LEGACY_HASH,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const report = await apply();

		expect(classificationOf(report, bob)).toBe("conflict");
		expect(classificationOf(report, alice)).toBe("conflict");
		expect(report.credentials.conflicting).toBe(2);

		// Alice's reconciliation is one unit, so the user row that would have
		// carried the un-inserted credential is rolled back with it.
		const user = await readUser(alice);

		expect(user?.email).toBe("alice@example.com");
		expect(user?.username).toBeNull();
		expect(user?.authMigratedAt).toBeNull();
		expect(await readCredentials(alice)).toHaveLength(0);
	});

	it("reports a credential the migration did not write", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await db.insert(authAccounts).values({
			accountId: String(userId),
			providerId: CREDENTIAL_PROVIDER_ID,
			userId,
			password: LEGACY_HASH,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const report = await audit();

		expect(classificationOf(report, userId)).toBe("conflict");
		expect(report.counts.migrated).toEqual({ active: 0, deactivated: 0 });
	});

	it("reports migration state with no credential to show for it", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await db
			.update(users)
			.set({ authMigratedAt: new Date() })
			.where(eq(users.id, userId));

		const report = await audit();

		expect(classificationOf(report, userId)).toBe("conflict");
	});
});

describe("password writes before cutover", () => {
	it("carries an account password change onto the credential", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: await hashPassword(LEGACY_PASSWORD),
		});

		await apply();

		await changePassword(db, {
			userId,
			oldPassword: LEGACY_PASSWORD,
			password: "a-brand-new-password",
			ip: "127.0.0.1",
		});

		const user = await readUser(userId);
		const [credential] = await readCredentials(userId);

		expect(credential?.password).toBe(user?.password.toString("utf8"));

		// A rerun sees the pair agreeing, so nothing is left for an operator.
		const report = await apply();

		expect(report.counts.migrated).toEqual({ active: 1, deactivated: 0 });
		expect(report.counts.stale).toEqual({ active: 0, deactivated: 0 });
	});

	it("carries an administrator reset onto the credential", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await apply();

		await updateUser(db, userId, { password: "an-administrator-reset" });

		const user = await readUser(userId);
		const [credential] = await readCredentials(userId);

		expect(credential?.password).toBe(user?.password.toString("utf8"));
		expect(credential?.password).not.toBe(LEGACY_HASH);
	});

	it("corrects a stale credential rather than calling it a conflict", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await apply();

		// A password written the way a path that predates the credential sync
		// would have written it: `users` alone.
		const rotated = await hashPassword("rotated-behind-the-credential");

		await db
			.update(users)
			.set({ password: rotated })
			.where(eq(users.id, userId));

		const found = await audit();

		expect(found.counts.stale).toEqual({ active: 1, deactivated: 0 });
		expect(found.counts.conflict).toEqual({ active: 0, deactivated: 0 });

		const report = await apply();

		expect(report.credentials.updated).toBe(1);

		const [credential] = await db
			.select()
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.userId, userId),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				),
			);

		expect(credential?.password).toBe(rotated.toString("utf8"));
	});
});

describe("normalized email uniqueness", () => {
	it("refuses a second migrated user the same address", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: legacyPassword(),
		});

		await apply();

		const other = await seedUser(db, {
			handle: "bob",
			email: "bob@example.com",
			password: legacyPassword(),
		});

		await apply();

		await expect(
			db
				.update(users)
				.set({ email: "ALICE@example.com" })
				.where(eq(users.id, other)),
		).rejects.toThrow();

		expect((await readUser(userId))?.email).toBe("alice@example.com");
	});
});
