import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authAccounts, authTwoFactors } from "../db/schema/auth";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	completeAccountSetup,
	completeEmailRemediation,
	completeTotpEnrollment,
	EmailInUseError,
	normalizeEmail,
	SetupNotEligibleError,
	TotpNotEnrolledError,
} from "./lifecycle";
import { hashPassword, verifyPassword } from "./password";
import { SetupCredentialError } from "./setup";
import { seedSetupSession, seedSetupToken, seedUser } from "./test/fixtures";

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database ??= await createTestDatabase();
	db = database.db;
	await db.delete(setupSessions);
	await db.delete(setupTokens);
	await db.delete(authAccounts);
	await db.delete(authTwoFactors);
	await db.delete(users);
}, 60_000);

async function readUser(userId: number) {
	const [row] = await db.select().from(users).where(eq(users.id, userId));
	if (!row) {
		throw new Error("user missing");
	}
	return row;
}

describe("normalizeEmail", () => {
	it.each([
		["  Ada@Example.com ", "ada@example.com"],
		["ADA@EXAMPLE.COM", "ada@example.com"],
		["", ""],
	])("folds %j to %j", (input, expected) => {
		expect(normalizeEmail(input)).toBe(expected);
	});
});

describe("completeAccountSetup", () => {
	it("credentials a pending account and moves it to normal", async () => {
		const userId = await seedUser(db, {
			handle: "Ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion");

		const user = await completeAccountSetup(db, {
			token,
			password: "a-good-password",
			email: "Ada@Example.com",
		});

		expect(user.lifecycleState).toBe("normal");

		const row = await readUser(userId);
		expect(row.email).toBe("ada@example.com");
		expect(row.emailVerified).toBe(true);
		expect(row.username).toBe("ada");
		expect(row.displayUsername).toBe("Ada");
		expect(row.password).not.toBeNull();
		expect(
			await verifyPassword("a-good-password", row.password as Buffer),
		).toBe(true);
	});

	it("writes one Better Auth credential identity", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
			email: "ada@example.com",
		});

		const accounts = await db.select().from(authAccounts);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.providerId).toBe("credential");
		expect(accounts[0]?.accountId).toBe(String(userId));
		expect(accounts[0]?.password).not.toBeNull();
	});

	it("revokes every setup credential the account held", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");
		await seedSetupSession(db, userId, "account_completion");

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
			email: "ada@example.com",
		});

		expect(await db.select().from(setupSessions)).toHaveLength(0);
		const remaining = await db.select().from(setupTokens);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.consumedAt).toBeInstanceOf(Date);
	});

	it("refuses a token for the wrong purpose", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an account that is not pending", async () => {
		const userId = await seedUser(db);
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(SetupNotEligibleError);
	});

	it("refuses a deactivated account", async () => {
		const userId = await seedUser(db, {
			active: false,
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an address another account already holds", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, {
			handle: "ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
				email: "ADA@example.com",
			}),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	// The rollback is what makes a failed completion retryable. A spent token
	// against an unchanged account is a link the holder can never use again.
	it("rolls the whole transition back when it fails", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, {
			handle: "ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(EmailInUseError);

		const row = await readUser(userId);
		expect(row.lifecycleState).toBe("pending");
		expect(row.password).toBeNull();
		expect(await db.select().from(authAccounts)).toHaveLength(0);

		const [tokenRow] = await db.select().from(setupTokens);
		expect(tokenRow?.consumedAt).toBeNull();
	});

	it("cannot be replayed after it commits", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
			email: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "another-password",
				email: "ada@example.com",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);

		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("gives exactly one winner under concurrent completion", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "account_completion");

		const other = database.connect();

		try {
			const results = await Promise.allSettled([
				completeAccountSetup(db, {
					token,
					password: "a-good-password",
					email: "ada@example.com",
				}),
				completeAccountSetup(other.db, {
					token,
					password: "a-good-password",
					email: "ada@example.com",
				}),
			]);

			expect(
				results.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			expect(await db.select().from(authAccounts)).toHaveLength(1);
		} finally {
			await other.close();
		}
	});
});

describe("completeEmailRemediation", () => {
	it("claims the address and derives an identity from the legacy hash", async () => {
		const password = await hashPassword("legacy-password");
		const userId = await seedUser(db, { handle: "Ada", password });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await completeEmailRemediation(db, {
			token,
			email: " Ada@Example.com ",
		});

		const row = await readUser(userId);
		expect(row.email).toBe("ada@example.com");
		expect(row.emailVerified).toBe(true);
		expect(row.username).toBe("ada");

		const [account] = await db.select().from(authAccounts);
		expect(account?.password).toBe(password.toString("utf8"));
	});

	it("refuses a pending account", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			completeEmailRemediation(db, { token, email: "ada@example.com" }),
		).rejects.toBeInstanceOf(SetupNotEligibleError);
	});

	it("refuses an empty address", async () => {
		const userId = await seedUser(db);
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			completeEmailRemediation(db, { token, email: "   " }),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it("refuses an address another account already holds", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, { handle: "ada" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			completeEmailRemediation(db, { token, email: "ada@example.com" }),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it("is idempotent against a retry with the same address", async () => {
		const userId = await seedUser(db);
		const first = await seedSetupToken(db, userId, "email_remediation");
		await completeEmailRemediation(db, {
			token: first.token,
			email: "ada@example.com",
		});

		const second = await seedSetupToken(db, userId, "email_remediation");
		await completeEmailRemediation(db, {
			token: second.token,
			email: "ada@example.com",
		});

		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});
});

describe("completeTotpEnrollment", () => {
	async function seedTwoFactor(userId: number, verified: boolean) {
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "secret",
			userId,
			verified,
		});
	}

	it("releases the restriction once a verified enrollment exists", async () => {
		const userId = await seedUser(db);
		await seedTwoFactor(userId, true);
		await seedSetupSession(db, userId, "totp_enrollment");

		const user = await completeTotpEnrollment(db, { userId });

		expect(user.id).toBe(userId);
		expect((await readUser(userId)).twoFactorEnabled).toBe(true);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
	});

	it("refuses an unverified enrollment and keeps the restriction", async () => {
		const userId = await seedUser(db);
		await seedTwoFactor(userId, false);
		await seedSetupSession(db, userId, "totp_enrollment");

		await expect(completeTotpEnrollment(db, { userId })).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);

		expect(await db.select().from(setupSessions)).toHaveLength(1);
	});

	it("refuses when nothing was enrolled at all", async () => {
		const userId = await seedUser(db);

		await expect(completeTotpEnrollment(db, { userId })).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);
	});

	it("refuses a deactivated user", async () => {
		const userId = await seedUser(db, { active: false });
		await seedTwoFactor(userId, true);

		await expect(completeTotpEnrollment(db, { userId })).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);
	});

	it("refuses a pending account", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		await seedTwoFactor(userId, true);

		await expect(completeTotpEnrollment(db, { userId })).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);
	});
});
