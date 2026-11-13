import { eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { keyring } from "../crypto/test/fixtures";
import type { Db } from "../db/pg";
import { apiKeys } from "../db/schema/apiKeys";
import {
	authAccounts,
	authPasskeys,
	authSessions,
	authTwoFactors,
	authVerifications,
} from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { settings } from "../db/schema/settings";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { openEmailTemplate } from "../email/link";
import { seedSettings } from "../settings/test/fixtures";
import { PendingAccountError, UserNotFoundError } from "../users/data";
import {
	AccessRevocationForbiddenError,
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
	revokeUserAccess,
	SetupNotEligibleError,
	startEmailRemediation,
	TotpNotEnrolledError,
	verifyEmailRemediationToken,
} from "./lifecycle";
import { hashPassword, verifyPassword } from "./password";
import {
	completePasswordRecovery,
	getSelfServiceRecoveryTarget,
	issueRecoveryLink,
} from "./recovery";
import { SetupCredentialError } from "./setup";
import {
	seedApiKey,
	seedSession,
	seedSetupSession,
	seedSetupToken,
	seedUser,
} from "./test/fixtures";

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
	await db.delete(authVerifications);
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
		keyring,
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
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "Ada@Example.com",
		});

		const result = await completeAccountSetup(db, {
			keyring,
			token,
			password: "a-good-password",
			username: "Ada",
		});

		expect(result.user.lifecycleState).toBe("normal");
		expect(result.user.username).toBe("ada");

		const row = await readUser(userId);
		expect(row.email).toBe("ada@example.com");
		expect(row.emailVerified).toBe(true);
		expect(row.username).toBe("ada");
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
			keyring,
			token,
			password: "a-good-password",
			username: "ada",
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
			keyring,
			token,
			password: "a-good-password",
			username: "ada",
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
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
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
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
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
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
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
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
			}),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("refuses an address another account already holds", async () => {
		await seedUser(db, {
			authMigratedAt: new Date(),
			username: "bob",
			email: "ada@example.com",
		});
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
			}),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it("refuses an address another account holds with surrounding whitespace", async () => {
		await seedUser(db, {
			authMigratedAt: new Date(),
			username: "bob",
			email: " ADA@example.com ",
		});
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
			}),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	// The rollback is what makes a failed completion retryable. A spent token
	// against an unchanged account is a link the holder can never use again.
	it("rolls the whole transition back when it fails", async () => {
		await seedUser(db, {
			authMigratedAt: new Date(),
			username: "bob",
			email: "ada@example.com",
		});
		const userId = await seedUser(db, {
			email: "ada@example.com",
			lifecycleState: "pending",
		});
		const { token } = await seedSetupToken(db, userId, "account_completion", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeAccountSetup(db, {
				keyring,
				token,
				password: "a-good-password",
				username: "ada",
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
			keyring,
			token,
			password: "a-good-password",
			username: "ada",
		});

		await expect(
			completeAccountSetup(db, {
				keyring,
				token,
				password: "another-password",
				username: "ada",
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
					keyring,
					token,
					password: "a-good-password",
					username: "ada",
				}),
				completeAccountSetup(other.db, {
					keyring,
					token,
					password: "a-good-password",
					username: "ada",
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
			username: "ada",
		});
		await seedSettings(db, { emailEnabled: true });

		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "new@example.com",
			keyring,
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
		const userId = await seedUser(db, { username: "ada" });
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
					keyring,
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
		const userId = await seedUser(db, { username: "ada" });
		await seedSettings(db, { emailEnabled: true });
		const other = database.connect();

		try {
			await Promise.all([
				startEmailRemediation(db, {
					deliveryAvailable: true,
					email: "first@example.com",
					keyring,
					getVerificationUrl: (token) =>
						`https://virtool.test/email-remediation-verify?token=${token}`,
					userId,
				}),
				startEmailRemediation(other.db, {
					deliveryAvailable: true,
					email: "second@example.com",
					keyring,
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
					const opened = openEmailTemplate(
						keyring,
						message.template,
						message.link,
					);
					if (opened?.type !== "email_verification") {
						throw new Error("expected verification message");
					}
					const token = new URL(opened.verifyUrl).searchParams.get("token");
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
		const userId = await seedUser(db, { username: "ada", password });
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
			username: "ada",
			password: await hashPassword("legacy-password"),
		});
		const token = await startOfflineEmailRemediation(userId, "ada@example.com");

		await completeEmailRemediation(db, {
			token,
			userId,
			verified: true,
		});

		const other = await seedUser(db, {
			username: "other",
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
		await seedUser(db, { username: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, { username: "ada" });

		await expect(
			prepareEmailRemediation(db, { userId, email: "ada@example.com" }),
		).rejects.toBeInstanceOf(EmailInUseError);
	});

	it.each([{ active: true }, { active: false }])(
		"lets a mailbox claim an address a legacy account records (active: $active)",
		async ({ active }) => {
			await seedUser(db, { active, username: "bob", email: "ada@example.com" });
			const userId = await seedUser(db, {
				username: "ada",
				email: "ada@example.com",
			});
			await seedSettings(db, { emailEnabled: true });

			await expect(
				startEmailRemediation(db, {
					deliveryAvailable: true,
					email: "ada@example.com",
					keyring,
					getVerificationUrl: () => "https://virtool.test/verify",
					userId,
				}),
			).resolves.toEqual({ status: "verification_required" });

			const { token } = await seedSetupToken(db, userId, "email_remediation", {
				candidateEmail: "ada@example.com",
			});
			await completeEmailRemediation(db, { token, userId, verified: true });

			expect(await readUser(userId)).toMatchObject({
				email: "ada@example.com",
				emailVerified: true,
			});
		},
	);

	it("refuses an offline claim to an address a legacy account records", async () => {
		await seedUser(db, { username: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, { username: "ada" });

		await expect(
			startEmailRemediation(db, {
				deliveryAvailable: false,
				email: "ada@example.com",
				keyring,
				getVerificationUrl: () => "https://virtool.test/unused",
				userId,
			}),
		).rejects.toBeInstanceOf(EmailInUseError);
		expect(await db.select().from(setupTokens)).toHaveLength(0);
	});

	it("refuses an unverified completion to an address a legacy account records", async () => {
		await seedUser(db, { username: "bob", email: "ada@example.com" });
		const userId = await seedUser(db, { username: "ada" });
		const { token } = await seedSetupToken(db, userId, "email_remediation", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeEmailRemediation(db, { token, userId, verified: false }),
		).rejects.toBeInstanceOf(EmailInUseError);
		expect((await readUser(userId)).authMigratedAt).toBeNull();
	});

	it("refuses a mailbox claim to an address a deactivated migrated account holds", async () => {
		await seedUser(db, {
			active: false,
			authMigratedAt: new Date(),
			username: "bob",
			email: "ada@example.com",
		});
		const userId = await seedUser(db, { username: "ada" });
		const { token } = await seedSetupToken(db, userId, "email_remediation", {
			candidateEmail: "ada@example.com",
		});

		await expect(
			completeEmailRemediation(db, { token, userId, verified: true }),
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
		const firstUserId = await seedUser(db, { username: "ada" });
		const secondUserId = await seedUser(db, { username: "bob" });
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
		const userId = await seedUser(db, { username: "ada" });
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
		const userId = await seedUser(db, { username: "ada" });
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
		const userId = await seedUser(db, { username: "ada" });
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
		const userId = await seedUser(db, { username: "ada" });
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
		const userId = await seedUser(db, { username: "ada" });
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
		const userId = await seedUser(db, { username: "ada" });
		await seedSettings(db, { emailEnabled: true });
		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "ada@example.com",
			keyring,
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
			keyring,
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
		const userId = await seedUser(db, { username: "ada" });
		await seedSettings(db, { emailEnabled: true });
		const input = {
			deliveryAvailable: true,
			keyring,
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
		const userId = await seedUser(db, { username: "ada" });
		const setup = await seedSetupSession(db, userId, "email_remediation");
		await seedSettings(db, { emailEnabled: true });

		await startEmailRemediation(db, {
			deliveryAvailable: true,
			email: "ada@example.com",
			keyring,
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
		const otherId = await seedUser(db, { username: "bob" });
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

describe("revokeUserAccess", () => {
	async function seedAccount(username: string, email: string): Promise<number> {
		const userId = await seedUser(db, {
			authMigratedAt: new Date(),
			email,
			username,
			password: await hashPassword("original-password"),
		});
		const now = new Date();
		await db
			.update(users)
			.set({ emailVerified: true, twoFactorEnabled: true })
			.where(eq(users.id, userId));
		await db.insert(authAccounts).values({
			accountId: String(userId),
			createdAt: now,
			password: (await hashPassword("original-password")).toString("utf8"),
			providerId: "credential",
			updatedAt: now,
			userId,
		});
		await db.insert(authTwoFactors).values({
			backupCodes: "encrypted",
			secret: "secret",
			userId,
		});
		await db.insert(authPasskeys).values({
			backedUp: false,
			counter: 0,
			credentialID: `credential-${userId}`,
			deviceType: "singleDevice",
			publicKey: "key",
			userId,
		});
		await seedVerification(`trust-device-${userId}`, String(userId));
		await seedVerification(`2fa-${userId}`, String(userId));
		await seedApiKey(db, userId);
		await seedSession(db, userId);
		await seedSetupSession(db, userId, "email_remediation");
		await seedSetupToken(db, userId, "administrator_recovery");
		return userId;
	}

	async function seedVerification(identifier: string, value: string) {
		const now = new Date();
		await db.insert(authVerifications).values({
			createdAt: now,
			expiresAt: new Date(now.getTime() + 60_000),
			identifier,
			updatedAt: now,
			value,
		});
	}

	async function readCredentialPassword(userId: number) {
		const [row] = await db
			.select({ password: authAccounts.password })
			.from(authAccounts)
			.where(eq(authAccounts.userId, userId));
		return Buffer.from(row?.password ?? "", "utf8");
	}

	it("removes every credential of the user and no one else's", async () => {
		const issuerId = await seedUser(db, {
			administratorRole: "users",
			username: "admin",
		});
		const userId = await seedAccount("alice", "alice@example.com");
		const otherId = await seedAccount("bob", "bob@example.com");

		const user = await revokeUserAccess(db, userId, issuerId);

		expect(user).toMatchObject({ id: userId, twoFactorEnabled: false });
		for (const table of [
			apiKeys,
			authPasskeys,
			authSessions,
			authTwoFactors,
			setupSessions,
			setupTokens,
		]) {
			const rows = await db.select({ userId: table.userId }).from(table);
			expect(rows).toEqual([{ userId: otherId }]);
		}
		const verifications = await db.select().from(authVerifications);
		expect(verifications.map((row) => row.identifier).sort()).toEqual([
			`2fa-${otherId}`,
			`trust-device-${otherId}`,
		]);
	});

	it("replaces the password on both sides of the migration", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedAccount("alice", "alice@example.com");

		await revokeUserAccess(db, userId, issuerId);

		const { password } = await readUser(userId);
		const credential = await readCredentialPassword(userId);
		expect(password).toEqual(credential);
		expect(await verifyPassword("original-password", credential)).toBe(false);
	});

	it("leaves Better Auth rows that only share a value with the user id", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedAccount("alice", "alice@example.com");
		await seedVerification("2fa-attempts-abc", String(userId));
		await seedVerification("2fa-otp-abc", String(userId));

		await revokeUserAccess(db, userId, issuerId);

		const verifications = await db.select().from(authVerifications);
		expect(verifications.map((row) => row.identifier).sort()).toEqual([
			"2fa-attempts-abc",
			"2fa-otp-abc",
		]);
	});

	it("closes self-service recovery and sends no email", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedAccount("alice", "alice@example.com");

		await revokeUserAccess(db, userId, issuerId);

		expect((await readUser(userId)).emailVerified).toBe(false);
		expect(await getSelfServiceRecoveryTarget(db, "alice")).toBeNull();
		expect(await db.select().from(emailOutbox)).toHaveLength(0);
	});

	it("leaves a copy-only administrator link as the way back in", async () => {
		const issuerId = await seedUser(db, {
			administratorRole: "users",
			username: "admin",
		});
		const userId = await seedAccount("alice", "alice@example.com");
		await revokeUserAccess(db, userId, issuerId);

		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			issuerUserId: issuerId,
			deliveryAvailable: true,
			keyring,
			getRecoveryUrl: (token) => token,
		});
		await completePasswordRecovery(
			db,
			issued.token,
			"administrator_recovery",
			"replacement-password",
		);

		expect(issued.delivery).toBe("copy_only");
		expect(
			await verifyPassword(
				"replacement-password",
				await readCredentialPassword(userId),
			),
		).toBe(true);
	});

	it("revokes a deactivated user", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedAccount("alice", "alice@example.com");
		await db.update(users).set({ active: false }).where(eq(users.id, userId));

		await revokeUserAccess(db, userId, issuerId);

		expect(await db.select().from(apiKeys)).toHaveLength(0);
	});

	it("replaces the password of an account with no credential row", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedUser(db, {
			password: await hashPassword("original-password"),
		});

		await revokeUserAccess(db, userId, issuerId);

		const { password } = await readUser(userId);
		expect(
			await verifyPassword("original-password", password ?? Buffer.alloc(0)),
		).toBe(false);
	});

	it("refuses an administrator target without the full role and changes nothing", async () => {
		const issuerId = await seedUser(db, {
			administratorRole: "users",
			username: "admin",
		});
		const userId = await seedAccount("alice", "alice@example.com");
		await db
			.update(users)
			.set({ administratorRole: "base" })
			.where(eq(users.id, userId));

		await expect(revokeUserAccess(db, userId, issuerId)).rejects.toBeInstanceOf(
			AccessRevocationForbiddenError,
		);

		expect(await db.select().from(apiKeys)).toHaveLength(1);
		expect((await readUser(userId)).emailVerified).toBe(true);
	});

	it("lets a full administrator revoke an administrator", async () => {
		const issuerId = await seedUser(db, {
			administratorRole: "full",
			username: "admin",
		});
		const userId = await seedAccount("alice", "alice@example.com");
		await db
			.update(users)
			.set({ administratorRole: "full" })
			.where(eq(users.id, userId));

		await revokeUserAccess(db, userId, issuerId);

		expect(await db.select().from(apiKeys)).toHaveLength(0);
	});

	it("refuses a pending account", async () => {
		const issuerId = await seedUser(db, { username: "admin" });
		const userId = await seedUser(db, { lifecycleState: "pending" });

		await expect(revokeUserAccess(db, userId, issuerId)).rejects.toBeInstanceOf(
			PendingAccountError,
		);
	});

	it("throws for an unknown user", async () => {
		const issuerId = await seedUser(db, { username: "admin" });

		await expect(
			revokeUserAccess(db, 999_999, issuerId),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});
});
