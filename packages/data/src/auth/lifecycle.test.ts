import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authAccounts, authTwoFactors } from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { settings } from "../db/schema/settings";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { seedSettings } from "../settings/test/fixtures";
import {
	completeAccountSetup,
	completeEmailRemediation,
	completeTotpEnrollment,
	EmailInUseError,
	normalizeEmail,
	prepareEmailRemediation,
	SetupNotEligibleError,
	startEmailRemediation,
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
	await db.delete(emailOutbox);
	await db.delete(settings);
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
		expect(row.authMigratedAt).toBeInstanceOf(Date);
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

	it("refuses an address another account holds with surrounding whitespace", async () => {
		const existing = await seedUser(db, {
			handle: "bob",
			email: " ADA@example.com ",
		});
		await db
			.update(users)
			.set({ authMigratedAt: new Date() })
			.where(eq(users.id, existing));
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
	it("keeps concurrent address submissions bound to their own tokens", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		await seedSettings(db, { emailEnabled: true });
		const other = database.connect();

		try {
			await Promise.all([
				startEmailRemediation(db, {
					deliveryAvailable: true,
					email: "first@example.com",
					getVerificationUrl: (token) =>
						`https://virtool.test/email-remediation-verify?token=${token}`,
					userId,
				}),
				startEmailRemediation(other.db, {
					deliveryAvailable: true,
					email: "second@example.com",
					getVerificationUrl: (token) =>
						`https://virtool.test/email-remediation-verify?token=${token}`,
					userId,
				}),
			]);

			const user = await readUser(userId);
			const messages = await db.select().from(emailOutbox);
			const current = messages.find(
				(message) => message.recipient === user.email,
			);
			const stale = messages.find(
				(message) => message.recipient !== user.email,
			);
			if (
				current?.template.type !== "email_verification" ||
				stale?.template.type !== "email_verification"
			) {
				throw new Error("expected two verification messages");
			}
			const currentToken = new URL(current.template.verifyUrl).searchParams.get(
				"token",
			);
			const staleToken = new URL(stale.template.verifyUrl).searchParams.get(
				"token",
			);
			if (!currentToken || !staleToken) {
				throw new Error("expected verification tokens");
			}

			await expect(
				completeEmailRemediation(db, {
					token: staleToken,
					userId,
					verified: true,
				}),
			).rejects.toBeInstanceOf(SetupCredentialError);
			await completeEmailRemediation(db, {
				token: currentToken,
				userId,
				verified: true,
			});
			expect((await readUser(userId)).email).toBe(user.email);
		} finally {
			await other.close();
		}
	});

	it("claims the address and derives an identity from the legacy hash", async () => {
		const password = await hashPassword("legacy-password");
		const userId = await seedUser(db, { handle: "Ada", password });
		await prepareEmailRemediation(db, {
			userId,
			email: " Ada@Example.com ",
		});
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await completeEmailRemediation(db, {
			token,
			userId,
			verified: true,
		});

		const row = await readUser(userId);
		expect(row.email).toBe("ada@example.com");
		expect(row.emailVerified).toBe(true);
		expect(row.username).toBe("ada");
		expect(row.authMigratedAt).toBeInstanceOf(Date);

		const [account] = await db.select().from(authAccounts);
		expect(account?.password).toBe(password.toString("utf8"));
	});

	it("places the remediated address under normalized uniqueness", async () => {
		const userId = await seedUser(db, {
			handle: "Ada",
			password: await hashPassword("legacy-password"),
		});
		await prepareEmailRemediation(db, { userId, email: "ada@example.com" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await completeEmailRemediation(db, {
			token,
			userId,
			verified: true,
		});

		const other = await seedUser(db, {
			handle: "other",
			email: "other@example.com",
		});
		await db
			.update(users)
			.set({ authMigratedAt: new Date() })
			.where(eq(users.id, other));

		await expect(
			db
				.update(users)
				.set({ email: " ADA@EXAMPLE.COM " })
				.where(eq(users.id, other)),
		).rejects.toThrow();
	});

	it("refuses a pending account", async () => {
		const userId = await seedUser(db, { lifecycleState: "pending" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");

		await expect(
			completeEmailRemediation(db, { token, userId, verified: true }),
		).rejects.toBeInstanceOf(SetupNotEligibleError);
	});

	it("refuses an empty address while staging", async () => {
		const userId = await seedUser(db);

		await expect(
			prepareEmailRemediation(db, { userId, email: "   " }),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it("refuses an address another account already holds while staging", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, { handle: "ada" });

		await expect(
			prepareEmailRemediation(db, { userId, email: "ada@example.com" }),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it("leaves an offline-remediated address explicitly unverified", async () => {
		const userId = await seedUser(db);
		await prepareEmailRemediation(db, { userId, email: "ada@example.com" });
		const { token } = await seedSetupToken(db, userId, "email_remediation");
		await completeEmailRemediation(db, {
			token,
			userId,
			verified: false,
		});

		expect((await readUser(userId)).emailVerified).toBe(false);
		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("binds completion to the restricted setup user", async () => {
		const firstUserId = await seedUser(db, { handle: "ada" });
		const secondUserId = await seedUser(db, { handle: "bob" });
		await prepareEmailRemediation(db, {
			userId: firstUserId,
			email: "ada@example.com",
		});
		const { token } = await seedSetupToken(
			db,
			firstUserId,
			"email_remediation",
		);

		await expect(
			completeEmailRemediation(db, {
				token,
				userId: secondUserId,
				verified: true,
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
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
