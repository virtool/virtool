import { eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { authAccounts, authSessions, authTwoFactors } from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { sessions } from "../db/schema/sessions";
import { settings } from "../db/schema/settings";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { seedSettings } from "../settings/test/fixtures";
import { UserNotFoundError } from "../users/data";
import {
	cancelEmailRemediation,
	changeEmailRemediation,
	claimEmailRemediationPromotion,
	completeAccountSetup,
	completeEmailRemediation,
	EmailInUseError,
	EmailRemediationRateLimitedError,
	getEmailRemediationState,
	prepareEmailRemediation,
	resendEmailRemediation,
	resetUserTotp,
	SetupNotEligibleError,
	startEmailRemediation,
	TotpNotEnrolledError,
	verifyEmailRemediationToken,
} from "./lifecycle";
import { hashPassword, verifyPassword } from "./password";
import { createAuthenticatedSession } from "./session";
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

async function startOfflineEmailRemediation(userId: number, email: string) {
	const result = await startEmailRemediation(db, {
		deliveryAvailable: false,
		email,
		getVerificationUrl: () => "https://virtool.test/unused",
		userId,
	});
	if (result.status !== "offline") {
		throw new Error("expected offline remediation");
	}
	return result.token;
}

describe("completeAccountSetup", () => {
	it("credentials a pending account and moves it to normal", async () => {
		const userId = await seedUser(db, {
			email: "Ada@Example.com",
			handle: "Ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "Ada@Example.com",
		});

		const result = await completeAccountSetup(db, {
			token,
			password: "a-good-password",
		});

		expect(result.user.lifecycleState).toBe("normal");

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
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
		});

		const accounts = await db.select().from(authAccounts);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.providerId).toBe("credential");
		expect(accounts[0]?.accountId).toBe(String(userId));
		expect(accounts[0]?.password).not.toBeNull();
	});

	it("revokes every setup credential the account held", async () => {
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});
		await seedSetupSession(db, userId, "account_completion");

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
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
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an account that is not pending", async () => {
		const userId = await seedUser(db);
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
			}),
		).rejects.toBeInstanceOf(SetupNotEligibleError);
	});

	it("refuses a token without a bound address", async () => {
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion");

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
			}),
		).rejects.toBeInstanceOf(SetupNotEligibleError);

		const row = await readUser(userId);
		expect(row.lifecycleState).toBe("pending");
	});

	it("refuses a deactivated account", async () => {
		const userId = await seedUser(db, {
			active: false,
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an address another account already holds", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, {
			email: "ada@example.com",
			handle: "ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
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
			email: "ada@example.com",
			handle: "ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
			}),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	// The rollback is what makes a failed completion retryable. A spent token
	// against an unchanged account is a link the holder can never use again.
	it("rolls the whole transition back when it fails", async () => {
		await seedUser(db, { handle: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, {
			email: "ada@example.com",
			handle: "ada",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "a-good-password",
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
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await completeAccountSetup(db, {
			token,
			password: "a-good-password",
		});

		await expect(
			completeAccountSetup(db, {
				token,
				password: "another-password",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);

		expect(await db.select().from(authAccounts)).toHaveLength(1);
	});

	it("gives exactly one winner under concurrent completion", async () => {
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		const other = database.connect();

		try {
			const results = await Promise.allSettled([
				completeAccountSetup(db, {
					token,
					password: "a-good-password",
				}),
				completeAccountSetup(other.db, {
					token,
					password: "a-good-password",
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
	it("keeps a staged address off the user row until completion", async () => {
		const userId = await seedUser(db, {
			email: "legacy@example.com",
			handle: "Ada",
		});
		await seedSettings(db, { emailEnabled: true });

		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "new@example.com",
			getVerificationUrl: (token) =>
				`https://virtool.test/email-remediation-verify?token=${token}`,
			userId,
		});

		expect((await readUser(userId)).email).toBe("legacy@example.com");
		expect(await getEmailRemediationState(db, userId)).toMatchObject({
			status: "pending",
			maskedEmail: "n***w@example.com",
		});
	});

	it("serializes address resubmission with verification completion", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const token = await startOfflineEmailRemediation(
			userId,
			"first@example.com",
		);
		const other = database.connect();

		try {
			const results = await Promise.allSettled([
				startEmailRemediation(db, {
					deliveryAvailable: false,
					email: "second@example.com",
					getVerificationUrl: () => "https://virtool.test/unused",
					userId,
				}),
				completeEmailRemediation(other.db, { token, userId, verified: true }),
			]);

			expect(
				results.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			for (const result of results) {
				if (result.status === "rejected") {
					expect(
						result.reason instanceof SetupCredentialError ||
							result.reason instanceof SetupNotEligibleError,
					).toBe(true);
				}
			}
			const row = await readUser(userId);
			if (results[1].status === "fulfilled") {
				expect(row.email).toBe("first@example.com");
				expect(row.authMigratedAt).not.toBeNull();
			} else {
				expect(row.authMigratedAt).toBeNull();
				expect(await getEmailRemediationState(db, userId)).toMatchObject({
					status: "pending",
					maskedEmail: "s***d@example.com",
				});
			}
		} finally {
			await other.close();
		}
	});

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

			const messages = await db.select().from(emailOutbox);
			if (
				messages.length !== 2 ||
				messages.some(
					(message) => message.template.type !== "email_verification",
				)
			) {
				throw new Error("expected two verification messages");
			}
			const attempts = await Promise.allSettled(
				messages.map((message) => {
					if (message.template.type !== "email_verification") {
						throw new Error("expected verification message");
					}
					const token = new URL(message.template.verifyUrl).searchParams.get(
						"token",
					);
					if (!token) {
						throw new Error("expected verification token");
					}
					return completeEmailRemediation(db, {
						token,
						userId,
						verified: true,
					});
				}),
			);
			expect(
				attempts.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			const winner = attempts.findIndex(
				(result) => result.status === "fulfilled",
			);
			expect((await readUser(userId)).email).toBe(messages[winner]?.recipient);
		} finally {
			await other.close();
		}
	});

	it("claims the address and derives an identity from the legacy hash", async () => {
		const password = await hashPassword("legacy-password");
		const userId = await seedUser(db, { handle: "Ada", password });
		const token = await startOfflineEmailRemediation(
			userId,
			" Ada@Example.com ",
		);

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
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");

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
		const { token } = await seedSetupToken(db, userId, "email_remediation", {
			candidateEmail: "ada@example.com",
		});

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
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");
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
		const { token } = await seedSetupToken(
			db,
			firstUserId,
			"email_remediation",
			{ candidateEmail: "ada@example.com" },
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

describe("email remediation journey", () => {
	it("verifies with the bearer token alone and leaves the setup browser resumable", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const setup = await seedSetupSession(db, userId, "email_remediation");
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");

		expect(await verifyEmailRemediationToken(db, token)).toEqual({
			status: "verified",
			userId,
		});
		expect(await db.select().from(setupSessions)).toHaveLength(1);
		expect(await getEmailRemediationState(db, userId)).toEqual({
			status: "verified",
		});
		expect(
			await claimEmailRemediationPromotion(db, userId, setup.sessionId),
		).toBe(true);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
	});

	it("allows exactly one promotion claim for a matching setup browser", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const setup = await seedSetupSession(db, userId, "email_remediation");
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");
		await verifyEmailRemediationToken(db, token);
		const other = database.connect();

		try {
			const claims = await Promise.all([
				claimEmailRemediationPromotion(db, userId, setup.sessionId),
				claimEmailRemediationPromotion(other.db, userId, setup.sessionId),
			]);
			expect(claims.sort()).toEqual([false, true]);
		} finally {
			await other.close();
		}
	});

	it("returns an already-verified result for replay and concurrent consumption", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");
		const other = database.connect();

		try {
			const results = await Promise.all([
				verifyEmailRemediationToken(db, token),
				verifyEmailRemediationToken(other.db, token),
			]);
			expect(results.map((result) => result.status).sort()).toEqual([
				"already_verified",
				"verified",
			]);
			expect(await verifyEmailRemediationToken(db, token)).toEqual({
				status: "already_verified",
				userId,
			});
		} finally {
			await other.close();
		}
	});

	it("classifies expired, superseded, and unknown tokens without changing users", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const expired = await seedSetupToken(db, userId, "email_remediation", {
			candidateEmail: "ada@example.com",
			expiresAt: new Date(Date.now() - 1_000),
		});
		const superseded = await seedSetupToken(db, userId, "email_remediation", {
			candidateEmail: "ada@example.com",
			supersededAt: new Date(),
		});

		expect(await verifyEmailRemediationToken(db, expired.token)).toEqual({
			status: "expired",
			userId,
		});
		expect(await verifyEmailRemediationToken(db, superseded.token)).toEqual({
			status: "superseded",
			userId,
		});
		expect(await verifyEmailRemediationToken(db, "0".repeat(64))).toEqual({
			status: "unusable",
		});
		expect((await readUser(userId)).authMigratedAt).toBeNull();
	});

	it("revokes the challenge on change and cancellation", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		await seedSetupSession(db, userId, "email_remediation");
		const first = await startOfflineEmailRemediation(userId, "ada@example.com");

		await changeEmailRemediation(db, userId);
		expect(await getEmailRemediationState(db, userId)).toEqual({
			status: "input",
		});
		expect(await verifyEmailRemediationToken(db, first)).toMatchObject({
			status: "superseded",
		});

		await startOfflineEmailRemediation(userId, "ada@example.com");
		await cancelEmailRemediation(db, userId);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
		const live = await db
			.select()
			.from(setupTokens)
			.where(isNull(setupTokens.supersededAt));
		expect(live).toHaveLength(0);
	});

	it("reports terminal delivery failure and replaces the link on resend", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		await seedSettings(db, { emailEnabled: true });
		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "ada@example.com",
			getVerificationUrl: (token) =>
				`https://virtool.test/email-remediation-verify#token=${token}`,
			userId,
		});
		const [message] = await db.select().from(emailOutbox);
		if (!message) {
			throw new Error("expected verification message");
		}
		await db
			.update(emailOutbox)
			.set({ status: "failed" })
			.where(eq(emailOutbox.id, message.id));
		await db
			.update(setupTokens)
			.set({ createdAt: new Date(Date.now() - 61_000) })
			.where(isNull(setupTokens.supersededAt));

		expect(await getEmailRemediationState(db, userId)).toMatchObject({
			status: "pending",
			deliveryFailed: true,
			canResend: true,
		});
		await resendEmailRemediation(db, {
			deliveryAvailable: true,
			getVerificationUrl: (token) =>
				`https://virtool.test/email-remediation-verify#token=${token}`,
			userId,
		});
		expect(await db.select().from(emailOutbox)).toHaveLength(2);
		const tokens = await db.select().from(setupTokens);
		expect(tokens.filter((token) => token.supersededAt)).toHaveLength(1);
		expect(tokens.filter((token) => !token.supersededAt)).toHaveLength(1);
	});

	it("rate-limits immediate resend attempts", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		await seedSettings(db, { emailEnabled: true });
		const input = {
			deliveryAvailable: true,
			getVerificationUrl: (token: string) =>
				`https://virtool.test/email-remediation-verify#token=${token}`,
			userId,
		};
		await startEmailRemediation(db, { ...input, email: "ada@example.com" });

		await expect(resendEmailRemediation(db, input)).rejects.toBeInstanceOf(
			EmailRemediationRateLimitedError,
		);
		expect(await db.select().from(emailOutbox)).toHaveLength(1);
	});

	it("extends the initiating setup session to the link expiry", async () => {
		const userId = await seedUser(db, { handle: "Ada" });
		const setup = await seedSetupSession(db, userId, "email_remediation");
		await seedSettings(db, { emailEnabled: true });

		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "ada@example.com",
			getVerificationUrl: () => "https://virtool.test/verify",
			setupSessionId: setup.sessionId,
			userId,
		});

		const [session] = await db.select().from(setupSessions);
		const [token] = await db.select().from(setupTokens);
		expect(session?.expiresAt).toEqual(token?.expiresAt);
	});
});

describe("resetUserTotp", () => {
	async function seedTwoFactor(userId: number) {
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "secret",
			userId,
		});
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
	}

	async function seedAuthSession(userId: number) {
		const now = new Date();
		await db.insert(authSessions).values({
			createdAt: now,
			expiresAt: new Date(now.getTime() + 60_000),
			token: `token-${userId}-${now.getTime()}-${Math.random()}`,
			updatedAt: now,
			userId,
		});
	}

	it("removes the factor and every session of the user", async () => {
		const userId = await seedUser(db);
		const otherId = await seedUser(db, { handle: "bob" });
		await seedTwoFactor(userId);
		await seedTwoFactor(otherId);
		await Promise.all([
			seedAuthSession(userId),
			seedAuthSession(userId),
			seedAuthSession(otherId),
		]);

		const user = await resetUserTotp(db, userId);

		expect(user.id).toBe(userId);
		expect((await readUser(userId)).twoFactorEnabled).toBe(false);
		const factors = await db.select().from(authTwoFactors);
		expect(factors.map((row) => row.userId)).toEqual([otherId]);
		const remaining = await db.select().from(authSessions);
		expect(remaining.map((row) => row.userId)).toEqual([otherId]);
	});

	it("ends the user's legacy sessions", async () => {
		const userId = await seedUser(db);
		await seedTwoFactor(userId);
		await createAuthenticatedSession(db, { userId, ip: "127.0.0.1" });

		await resetUserTotp(db, userId);

		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it("resets a user whose flag is set without a factor", async () => {
		const userId = await seedUser(db);
		await db
			.update(users)
			.set({ twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await seedAuthSession(userId);

		await resetUserTotp(db, userId);

		expect((await readUser(userId)).twoFactorEnabled).toBe(false);
		expect(await db.select().from(authSessions)).toHaveLength(0);
	});

	it("leaves an abandoned enrollment and its user's sessions alone", async () => {
		const userId = await seedUser(db);
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "secret",
			userId,
		});
		await seedAuthSession(userId);

		await expect(resetUserTotp(db, userId)).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);

		expect(await db.select().from(authTwoFactors)).toHaveLength(1);
		expect(await db.select().from(authSessions)).toHaveLength(1);
	});

	it("refuses an unknown user", async () => {
		await expect(resetUserTotp(db, 999_999)).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});

	it("refuses a user with no factor and keeps their sessions", async () => {
		const userId = await seedUser(db);
		await seedAuthSession(userId);

		await expect(resetUserTotp(db, userId)).rejects.toBeInstanceOf(
			TotpNotEnrolledError,
		);

		expect(await db.select().from(authSessions)).toHaveLength(1);
	});
});
