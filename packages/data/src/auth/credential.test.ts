import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	CREDENTIAL_PROVIDER_ID,
	credentialAccountId,
	upgradePasswordHash,
} from "./credential";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { seedUser } from "./test/fixtures";

/** A `$2b$12$` hash of the password below, as legacy rows store it. */
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

async function seedMigratedUser(password: Buffer): Promise<number> {
	const userId = await seedUser(db, {
		authMigratedAt: new Date(),
		handle: "Alice",
		password,
	});

	await db.insert(authAccounts).values({
		accountId: credentialAccountId(userId),
		providerId: CREDENTIAL_PROVIDER_ID,
		userId,
		password: password.toString("utf8"),
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return userId;
}

async function readHashes(userId: number) {
	const [[user], [account]] = await Promise.all([
		db
			.select({ password: users.password })
			.from(users)
			.where(eq(users.id, userId)),
		db
			.select({ password: authAccounts.password })
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.userId, userId),
					eq(authAccounts.providerId, CREDENTIAL_PROVIDER_ID),
				),
			),
	]);

	return { user: user?.password ?? null, account: account?.password ?? null };
}

describe("upgradePasswordHash", () => {
	it("replaces a bcrypt hash in both credential stores", async () => {
		const userId = await seedMigratedUser(Buffer.from(LEGACY_HASH));

		expect(
			await upgradePasswordHash(db, {
				handle: "alice",
				password: LEGACY_PASSWORD,
			}),
		).toBe(true);

		const { user, account } = await readHashes(userId);
		expect(user).not.toBeNull();
		expect(needsRehash(user as Buffer)).toBe(false);
		expect(account).toBe(user?.toString("utf8"));
		expect(await verifyPassword(LEGACY_PASSWORD, user as Buffer)).toBe(true);
	});

	it("replaces the hash of an unmigrated user with no credential account", async () => {
		const userId = await seedUser(db, {
			handle: "alice",
			password: Buffer.from(LEGACY_HASH),
		});

		expect(
			await upgradePasswordHash(db, {
				handle: "alice",
				password: LEGACY_PASSWORD,
			}),
		).toBe(true);

		const { user, account } = await readHashes(userId);
		expect(needsRehash(user as Buffer)).toBe(false);
		expect(account).toBeNull();
	});

	it("leaves the hash unchanged for a wrong password", async () => {
		const userId = await seedMigratedUser(Buffer.from(LEGACY_HASH));

		expect(
			await upgradePasswordHash(db, { handle: "alice", password: "wrong" }),
		).toBe(false);

		const { user, account } = await readHashes(userId);
		expect(user?.toString("utf8")).toBe(LEGACY_HASH);
		expect(account).toBe(LEGACY_HASH);
	});

	it("leaves a current hash unchanged", async () => {
		const current = await hashPassword(LEGACY_PASSWORD);
		const userId = await seedMigratedUser(current);

		expect(
			await upgradePasswordHash(db, {
				handle: "alice",
				password: LEGACY_PASSWORD,
			}),
		).toBe(false);

		const { user } = await readHashes(userId);
		expect(user?.equals(current)).toBe(true);
	});

	it("leaves a credential account that holds another hash unchanged", async () => {
		const userId = await seedMigratedUser(Buffer.from(LEGACY_HASH));
		await db
			.update(authAccounts)
			.set({ password: "stale" })
			.where(eq(authAccounts.userId, userId));

		expect(
			await upgradePasswordHash(db, {
				handle: "alice",
				password: LEGACY_PASSWORD,
			}),
		).toBe(true);

		const { account } = await readHashes(userId);
		expect(account).toBe("stale");
	});

	it("returns false for an unknown handle", async () => {
		expect(
			await upgradePasswordHash(db, {
				handle: "nobody",
				password: LEGACY_PASSWORD,
			}),
		).toBe(false);
	});
});
