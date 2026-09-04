import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	consumeSetupToken,
	createSetupSession,
	deleteExpiredSetupState,
	invalidateSetupSession,
	invalidateUserSetupSessions,
	issueSetupToken,
	SetupCredentialError,
	supersedeSetupTokens,
	verifySetupSession,
} from "./setup";
import { seedSetupSession, seedSetupToken, seedUser } from "./test/fixtures";

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database ??= await createTestDatabase();
	db = database.db;
	await db.delete(setupSessions);
	await db.delete(setupTokens);
	await db.delete(users);
}, 60_000);

describe("issueSetupToken", () => {
	it("returns the plaintext once and stores only its digest", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });

		const issued = await issueSetupToken(db, {
			userId,
			purpose: "account_completion",
		});

		expect(issued.token).toMatch(/^[0-9a-f]{64}$/);
		expect(issued.userId).toBe(userId);
		expect(issued.purpose).toBe("account_completion");

		const rows = await db.select().from(setupTokens);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.tokenHash).not.toBe(issued.token);
		expect(rows[0]?.consumedAt).toBeNull();
	});

	it("supersedes an outstanding token for the same purpose", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const first = await issueSetupToken(db, {
			userId,
			purpose: "account_completion",
		});

		await issueSetupToken(db, { userId, purpose: "account_completion" });

		await expect(
			consumeSetupToken(db, first.token, "account_completion"),
		).rejects.toBeInstanceOf(SetupCredentialError);
		expect(await db.select().from(setupTokens)).toHaveLength(1);
	});

	it("leaves a token for a different purpose alone", async () => {
		const userId = await seedUser(db);
		const remediation = await issueSetupToken(db, {
			userId,
			purpose: "email_remediation",
		});

		await issueSetupToken(db, { userId, purpose: "totp_enrollment" });

		await expect(
			consumeSetupToken(db, remediation.token, "email_remediation"),
		).resolves.toEqual({ userId, purpose: "email_remediation" });
	});
});

describe("consumeSetupToken", () => {
	it("spends a live token and records the consumption", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			consumeSetupToken(db, token, "account_completion"),
		).resolves.toEqual({ userId, purpose: "account_completion" });

		const [row] = await db.select().from(setupTokens);
		expect(row?.consumedAt).toBeInstanceOf(Date);
	});

	it("refuses a second use", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await consumeSetupToken(db, token, "account_completion");

		await expect(
			consumeSetupToken(db, token, "account_completion"),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an unknown token", async () => {
		await expect(
			consumeSetupToken(db, "0".repeat(64), "account_completion"),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an expired token", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			expiresAt: new Date(Date.now() - 1_000),
		});

		await expect(
			consumeSetupToken(db, token, "account_completion"),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses a token presented for the wrong purpose", async () => {
		const userId = await seedUser(db);
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			consumeSetupToken(db, token, "totp_enrollment"),
		).rejects.toBeInstanceOf(SetupCredentialError);

		const [row] = await db.select().from(setupTokens);
		expect(row?.consumedAt).toBeNull();
	});

	it("refuses a token whose user has been deactivated", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await db.update(users).set({ active: false });

		await expect(
			consumeSetupToken(db, token, "account_completion"),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	/*
	 The fixture pool is max: 1, so two awaits a test starts together reach
	 Postgres one after the other. A second connection is what makes the two
	 transactions genuinely contend for the row.
	*/
	it("gives exactly one winner under concurrent submission", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		const other = database.connect();

		try {
			const results = await Promise.allSettled([
				db.transaction((tx) =>
					consumeSetupToken(tx, token, "account_completion"),
				),
				other.db.transaction((tx) =>
					consumeSetupToken(tx, token, "account_completion"),
				),
			]);

			expect(
				results.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			expect(
				results.filter((result) => result.status === "rejected"),
			).toHaveLength(1);
		} finally {
			await other.close();
		}
	});
});

describe("supersedeSetupTokens", () => {
	it("removes only the unspent tokens for that purpose", async () => {
		const userId = await seedUser(db);
		await seedSetupToken(db, userId, "email_remediation");
		await seedSetupToken(db, userId, "email_remediation", {
			consumedAt: new Date(),
		});
		await seedSetupToken(db, userId, "totp_enrollment");

		expect(await supersedeSetupTokens(db, userId, "email_remediation")).toBe(1);
		expect(await db.select().from(setupTokens)).toHaveLength(2);
	});
});

describe("createSetupSession", () => {
	it("returns a non-secret id and a secret, storing only the digest", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });

		const created = await createSetupSession(db, {
			userId,
			purpose: "account_completion",
			ip: "127.0.0.1",
		});

		expect(created.sessionId).toMatch(/^setup_[0-9a-f]{48}$/);
		expect(created.row.tokenHash).not.toBe(created.token);
		expect(created.row.purpose).toBe("account_completion");
	});

	it("replaces any restricted session the user already holds", async () => {
		const userId = await seedUser(db);
		const first = await seedSetupSession(db, userId, "email_remediation");

		await createSetupSession(db, {
			userId,
			purpose: "totp_enrollment",
			ip: "127.0.0.1",
		});

		expect(
			await verifySetupSession(db, first.sessionId, first.token),
		).toBeNull();
		expect(await db.select().from(setupSessions)).toHaveLength(1);
	});
});

describe("verifySetupSession", () => {
	it("resolves the user, session id, purpose and expiry, and nothing else", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const seeded = await seedSetupSession(db, userId, "account_completion");

		const resolved = await verifySetupSession(
			db,
			seeded.sessionId,
			seeded.token,
		);

		expect(Object.keys(resolved ?? {}).toSorted()).toEqual([
			"expiresAt",
			"purpose",
			"sessionId",
			"userId",
		]);
		expect(resolved?.userId).toBe(userId);
		expect(resolved?.purpose).toBe("account_completion");
	});

	it.each([
		["no session id", undefined, "token"],
		["no token", "setup_x", undefined],
	])("returns null with %s", async (_name, sessionId, token) => {
		expect(await verifySetupSession(db, sessionId, token)).toBeNull();
	});

	it("returns null for an unknown session", async () => {
		expect(
			await verifySetupSession(db, "setup_unknown", "0".repeat(64)),
		).toBeNull();
	});

	it("returns null when the secret does not match", async () => {
		const userId = await seedUser(db);
		const seeded = await seedSetupSession(db, userId, "totp_enrollment");

		expect(
			await verifySetupSession(db, seeded.sessionId, "0".repeat(64)),
		).toBeNull();
	});

	it("returns null once expired", async () => {
		const userId = await seedUser(db);
		const seeded = await seedSetupSession(db, userId, "totp_enrollment", {
			expiresAt: new Date(Date.now() - 1_000),
		});

		expect(
			await verifySetupSession(db, seeded.sessionId, seeded.token),
		).toBeNull();
	});

	it("returns null once the user is deactivated", async () => {
		const userId = await seedUser(db);
		const seeded = await seedSetupSession(db, userId, "totp_enrollment");

		await db.update(users).set({ active: false });

		expect(
			await verifySetupSession(db, seeded.sessionId, seeded.token),
		).toBeNull();
	});
});

describe("invalidateSetupSession", () => {
	it("deletes the named session and leaves the rest", async () => {
		const first = await seedUser(db, { handle: "alice" });
		const second = await seedUser(db, { handle: "bob" });
		const seeded = await seedSetupSession(db, first, "totp_enrollment");
		await seedSetupSession(db, second, "totp_enrollment");

		await invalidateSetupSession(db, seeded.sessionId);

		expect(await db.select().from(setupSessions)).toHaveLength(1);
	});
});

describe("invalidateUserSetupSessions", () => {
	it("deletes every session the user holds", async () => {
		const first = await seedUser(db, { handle: "alice" });
		const second = await seedUser(db, { handle: "bob" });
		await seedSetupSession(db, first, "totp_enrollment");
		await seedSetupSession(db, second, "totp_enrollment");

		await invalidateUserSetupSessions(db, first);

		const rows = await db.select().from(setupSessions);
		expect(rows.map((row) => row.userId)).toEqual([second]);
	});
});

describe("deleteExpiredSetupState", () => {
	it("removes expired rows from both tables and keeps live ones", async () => {
		const userId = await seedUser(db);
		const past = new Date(Date.now() - 60_000);

		await seedSetupToken(db, userId, "email_remediation", { expiresAt: past });
		await seedSetupToken(db, userId, "totp_enrollment", {
			expiresAt: past,
			consumedAt: new Date(),
		});
		await seedSetupToken(db, userId, "account_completion");
		await seedSetupSession(db, userId, "totp_enrollment", { expiresAt: past });

		expect(await deleteExpiredSetupState(db)).toEqual({
			tokens: 2,
			sessions: 1,
		});
		expect(await db.select().from(setupTokens)).toHaveLength(1);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
	});

	it("sweeps in more than one batch", async () => {
		const userId = await seedUser(db);
		const past = new Date(Date.now() - 60_000);

		for (const purpose of ["email_remediation", "totp_enrollment"] as const) {
			await seedSetupToken(db, userId, purpose, { expiresAt: past });
		}

		expect(await deleteExpiredSetupState(db, { batchSize: 1 })).toEqual({
			tokens: 2,
			sessions: 0,
		});
	});

	it("rejects a batch size that is not a positive integer", async () => {
		await expect(
			deleteExpiredSetupState(db, { batchSize: 0 }),
		).rejects.toBeInstanceOf(RangeError);
	});
});
