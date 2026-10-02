import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import { apiKeys } from "../db/schema/apiKeys";
import { authAccounts, authSessions } from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { setupSessions, setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { EMAIL_DELIVERY_DEADLINE_SECONDS } from "../email/retry";
import { seedSettings } from "../settings/test/fixtures";
import {
	changePassword,
	setAdministratorRole,
	updateUser,
} from "../users/data";
import {
	beginEmailVerification,
	completeEmailVerification,
	EmailVerificationRateLimitedError,
	inspectEmailVerificationLink,
} from "./emailVerification";
import { hashPassword, verifyPassword } from "./password";
import {
	completePasswordRecovery,
	getSelfServiceRecoveryTarget,
	inspectRecoveryLink,
	issueRecoveryLink,
	RecoveryNotEligibleError,
	RecoveryPasswordReuseError,
} from "./recovery";
import { SetupCredentialError } from "./setup";
import { seedApiKey, seedSession, seedUser } from "./test/fixtures";

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database ??= await createTestDatabase();
	db = database.db;
	await db.delete(emailOutbox);
	await db.delete(users);
	await seedSettings(db, { emailEnabled: true });
}, 60_000);

afterAll(async () => {
	await database?.drop();
});

async function seedMigratedUser(
	options: { handle?: string; email?: string; emailVerified?: boolean } = {},
) {
	const password = await hashPassword("current-password-123");
	const userId = await seedUser(db, {
		handle: options.handle ?? "ada",
		email: options.email ?? "ada@example.com",
		password,
	});
	await db
		.update(users)
		.set({
			authMigratedAt: new Date(),
			emailVerified: options.emailVerified ?? true,
		})
		.where(eq(users.id, userId));
	const now = new Date();
	await db.insert(authAccounts).values({
		accountId: String(userId),
		providerId: "credential",
		userId,
		password: password.toString("utf8"),
		createdAt: now,
		updatedAt: now,
	});
	return userId;
}

describe("email verification", () => {
	it("recognizes a legacy mixed-case current address", async () => {
		const userId = await seedMigratedUser({
			email: "Ada@Example.com",
			emailVerified: false,
		});
		let token = "";
		await beginEmailVerification(db, {
			userId,
			email: "ada@example.com",
			deliveryAvailable: true,
			getVerificationUrl(value) {
				token = value;
				return `https://virtool.test/verify-email#token=${value}`;
			},
		});
		expect(await inspectEmailVerificationLink(db, token)).toBe("current");
		await completeEmailVerification(db, token, "current");
		const [user] = await db.select().from(users).where(eq(users.id, userId));
		expect(user?.email).toBe("ada@example.com");
		expect(user?.emailVerified).toBe(true);
	});

	it("keeps the current address until the new mailbox proves control", async () => {
		const userId = await seedMigratedUser();
		let link = "";
		const started = await beginEmailVerification(db, {
			userId,
			email: " New@Example.com ",
			deliveryAvailable: true,
			getVerificationUrl(token) {
				link = token;
				return `https://virtool.test/verify-email#token=${token}`;
			},
		});
		expect(started.status).toBe("queued");
		const [before] = await db.select().from(users).where(eq(users.id, userId));
		expect(before?.email).toBe("ada@example.com");
		expect(before?.emailVerified).toBe(true);
		const [message] = await db.select().from(emailOutbox);
		expect(message?.recipient).toBe("new@example.com");
		expect(await inspectEmailVerificationLink(db, link)).toBe("change");

		await completeEmailVerification(db, link, "change", userId);
		const [after] = await db.select().from(users).where(eq(users.id, userId));
		expect(after?.email).toBe("new@example.com");
		expect(after?.emailVerified).toBe(true);
		expect(await inspectEmailVerificationLink(db, link)).toBe("unusable");
		await expect(
			completeEmailVerification(db, link, "change", userId),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("rolls back a challenge when delivery is unavailable", async () => {
		const userId = await seedMigratedUser();
		await expect(
			beginEmailVerification(db, {
				userId,
				email: "new@example.com",
				deliveryAvailable: false,
				getVerificationUrl: () => "unused",
			}),
		).rejects.toThrow();
		expect(await db.select().from(setupTokens)).toHaveLength(0);
	});

	it("applies the resend window to repeated initial requests", async () => {
		const userId = await seedMigratedUser();
		const input = {
			userId,
			email: "new@example.com",
			deliveryAvailable: true,
			getVerificationUrl: (token: string) =>
				`https://virtool.test/verify-email#token=${token}`,
		};
		await beginEmailVerification(db, input);
		await expect(beginEmailVerification(db, input)).rejects.toBeInstanceOf(
			EmailVerificationRateLimitedError,
		);
		expect(await db.select().from(setupTokens)).toHaveLength(1);
		expect(await db.select().from(emailOutbox)).toHaveLength(1);
	});
});

describe("password recovery", () => {
	it("keeps emailed links usable past the delivery retry deadline", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "password_recovery",
			deliveryAvailable: true,
			getRecoveryUrl: () => "https://virtool.test/recover",
		});
		expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(
			EMAIL_DELIVERY_DEADLINE_SECONDS * 1000,
		);
	});

	it("invalidates links when another password change wins", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "password_recovery",
			deliveryAvailable: true,
			getRecoveryUrl: () => "https://virtool.test/recover",
		});
		await changePassword(db, {
			userId,
			oldPassword: "current-password-123",
			password: "replacement-password-123",
		});
		expect(
			await inspectRecoveryLink(db, issued.token, "password_recovery"),
		).toBe("unusable");
	});

	it("invalidates links when an administrator resets a password", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: () => "https://virtool.test/recover",
		});
		await updateUser(db, userId, { password: "replacement-password-123" });
		expect(
			await inspectRecoveryLink(db, issued.token, "administrator_recovery"),
		).toBe("unusable");
	});

	it("invalidates links when an administrator forces a reset", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: () => "https://virtool.test/recover",
		});
		await updateUser(db, userId, { forceReset: true });
		expect(
			await inspectRecoveryLink(db, issued.token, "administrator_recovery"),
		).toBe("unusable");
	});

	it("invalidates administrator links on role changes", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: () => "https://virtool.test/recover",
		});
		await setAdministratorRole(db, userId, "full");
		expect(
			await inspectRecoveryLink(db, issued.token, "administrator_recovery"),
		).toBe("unusable");
	});

	it("rechecks issuer authority after target role changes", async () => {
		const userId = await seedMigratedUser();
		const issuerUserId = await seedUser(db, {
			handle: "issuer",
			administratorRole: "users",
		});
		await setAdministratorRole(db, userId, "full");
		await expect(
			issueRecoveryLink(db, {
				userId,
				issuerUserId,
				purpose: "administrator_recovery",
				deliveryAvailable: false,
				getRecoveryUrl: () => "https://virtool.test/recover",
			}),
		).rejects.toBeInstanceOf(RecoveryNotEligibleError);
	});

	it("queues a verified user's recovery link and revokes browser authority after use", async () => {
		const userId = await seedMigratedUser();
		await seedSession(db, userId);
		await seedApiKey(db, userId);
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "password_recovery",
			deliveryAvailable: true,
			getRecoveryUrl: (token) => `https://virtool.test/recover#token=${token}`,
		});
		expect(issued.delivery).toBe("queued");
		expect(await getSelfServiceRecoveryTarget(db, " ADA ")).toBe(userId);
		expect(
			await inspectRecoveryLink(db, issued.token, "password_recovery"),
		).toBe("usable");
		const [storedToken] = await db.select().from(setupTokens);
		expect(storedToken?.tokenHash).not.toBe(issued.token);
		const [mail] = await db.select().from(emailOutbox);
		expect(mail?.template.type).toBe("password_recovery");

		await completePasswordRecovery(
			db,
			issued.token,
			"password_recovery",
			"replacement-password-123",
		);
		const [user] = await db.select().from(users).where(eq(users.id, userId));
		expect(
			await verifyPassword(
				"replacement-password-123",
				user?.password as Buffer,
			),
		).toBe(true);
		expect(await db.select().from(authSessions)).toHaveLength(0);
		expect(await db.select().from(apiKeys)).toHaveLength(1);
		expect(await db.select().from(setupSessions)).toHaveLength(0);
		expect(await db.select().from(setupTokens)).toHaveLength(0);
		expect(
			await inspectRecoveryLink(db, issued.token, "password_recovery"),
		).toBe("unusable");
		await expect(
			completePasswordRecovery(
				db,
				issued.token,
				"password_recovery",
				"another-password-123",
			),
		).rejects.toBeInstanceOf(SetupCredentialError);
	});

	it("issues copy-only administrator recovery while mail is disabled", async () => {
		const userId = await seedMigratedUser({ emailVerified: false });
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: (token) => `https://virtool.test/recover#token=${token}`,
		});
		expect(issued.delivery).toBe("copy_only");
		expect(await db.select().from(emailOutbox)).toHaveLength(0);
		await expect(
			issueRecoveryLink(db, {
				userId,
				purpose: "password_recovery",
				deliveryAvailable: false,
				getRecoveryUrl: () => "unused",
			}),
		).rejects.toBeInstanceOf(RecoveryNotEligibleError);
	});

	it("refuses password reuse without consuming the link", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: () => "unused",
		});
		await expect(
			completePasswordRecovery(
				db,
				issued.token,
				"administrator_recovery",
				"current-password-123",
			),
		).rejects.toBeInstanceOf(RecoveryPasswordReuseError);
		expect(
			await inspectRecoveryLink(db, issued.token, "administrator_recovery"),
		).toBe("usable");
	});

	it("allows only one concurrent completion of a recovery link", async () => {
		const userId = await seedMigratedUser();
		const issued = await issueRecoveryLink(db, {
			userId,
			purpose: "administrator_recovery",
			deliveryAvailable: false,
			getRecoveryUrl: () => "unused",
		});
		const results = await Promise.allSettled([
			completePasswordRecovery(
				db,
				issued.token,
				"administrator_recovery",
				"first-password-123",
			),
			completePasswordRecovery(
				db,
				issued.token,
				"administrator_recovery",
				"second-password-123",
			),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
	});
});
