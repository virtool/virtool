import { EMAIL_REMEDIATION_RESEND_DELAY_SECONDS } from "@virtool/contracts";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { enqueueEmail } from "../email/outbox";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { isValidEmail, normalizeEmail } from "./email";
import { claimEmail } from "./lifecycle";
import {
	consumeSetupToken,
	issueSetupTokenInTransaction,
	lockUserSetupCredentials,
	SetupCredentialError,
	supersedeSetupTokens,
} from "./setup";
import { hashToken } from "./tokens";

const EMAIL_VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** A requested address cannot be verified for this account. */
export class EmailVerificationError extends AppError {}

/** Another verification request must wait for the resend window. */
export class EmailVerificationRateLimitedError extends AppError {}

/** The mail service could not accept the verification challenge. */
export class EmailVerificationUnavailableError extends AppError {}

/** Inputs for issuing a challenge for the current or a proposed address. */
export type BeginEmailVerificationInput = {
	userId: number;
	email: string;
	deliveryAvailable: boolean;
	getVerificationUrl: (token: string) => string;
};

/** The non-secret result of queuing an email-verification challenge. */
export type BegunEmailVerification = {
	status: "queued";
	expiresAt: Date;
	resendAt: Date;
};

/** Queue a challenge while leaving the current address and verified flag intact. */
export async function beginEmailVerification(
	db: Db,
	input: BeginEmailVerificationInput,
): Promise<BegunEmailVerification> {
	if (!input.deliveryAvailable) {
		throw new EmailVerificationUnavailableError();
	}
	const candidateEmail = normalizeEmail(input.email);
	if (!isValidEmail(candidateEmail) || candidateEmail.length > 254) {
		throw new EmailVerificationError();
	}

	return db.transaction(async (tx) => {
		await lockUserSetupCredentials(tx, input.userId);
		const [user] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
				email: users.email,
				emailVerified: users.emailVerified,
				handle: users.handle,
				lifecycleState: users.lifecycleState,
			})
			.from(users)
			.where(eq(users.id, input.userId))
			.for("update")
			.limit(1);
		if (
			!user?.active ||
			!user.authMigratedAt ||
			user.lifecycleState !== "normal"
		) {
			throw new EmailVerificationError();
		}
		if (candidateEmail === normalizeEmail(user.email) && user.emailVerified) {
			throw new EmailVerificationError();
		}
		await claimEmail(tx, input.userId, candidateEmail);

		const [current] = await tx
			.select({
				canResend: sql<boolean>`${setupTokens.createdAt} <= timezone('utc', clock_timestamp()) - make_interval(secs => ${EMAIL_REMEDIATION_RESEND_DELAY_SECONDS})`,
			})
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.userId, input.userId),
					eq(setupTokens.purpose, "email_verification"),
					isNull(setupTokens.consumedAt),
					isNull(setupTokens.supersededAt),
					sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
				),
			)
			.limit(1);
		if (current && !current.canResend) {
			throw new EmailVerificationRateLimitedError();
		}

		const issued = await issueSetupTokenInTransaction(tx, {
			userId: input.userId,
			purpose: "email_verification",
			candidateEmail,
			sourceEmail: user.email,
			lifetimeMs: EMAIL_VERIFICATION_LIFETIME_MS,
		});
		const queued = await enqueueEmail(tx, {
			idempotencyKey: `email_verification/${input.userId}/${issued.tokenId}`,
			recipient: candidateEmail,
			template: {
				type: "email_verification",
				username: user.handle,
				verifyUrl: input.getVerificationUrl(issued.token),
				expiresInHours: EMAIL_VERIFICATION_LIFETIME_MS / (60 * 60 * 1000),
			},
		});
		if (queued.status !== "queued") {
			throw new EmailVerificationUnavailableError();
		}
		return {
			status: "queued" as const,
			expiresAt: issued.expiresAt,
			resendAt: new Date(
				Date.now() + EMAIL_REMEDIATION_RESEND_DELAY_SECONDS * 1000,
			),
		};
	});
}

/** How a challenge is permitted to change the address. */
export type EmailVerificationMode = "current" | "change";

/** Inspect only the challenge kind, revealing no account identity. */
export async function inspectEmailVerificationLink(
	db: Db,
	token: string,
): Promise<EmailVerificationMode | "unusable"> {
	const [row] = await db
		.select({
			active: users.active,
			authMigratedAt: users.authMigratedAt,
			candidateEmail: setupTokens.candidateEmail,
			currentEmail: users.email,
			lifecycleState: users.lifecycleState,
			sourceEmail: setupTokens.sourceEmail,
		})
		.from(setupTokens)
		.innerJoin(users, eq(users.id, setupTokens.userId))
		.where(
			and(
				eq(setupTokens.tokenHash, hashToken(token)),
				eq(setupTokens.purpose, "email_verification"),
				isNull(setupTokens.consumedAt),
				isNull(setupTokens.supersededAt),
				sql`${setupTokens.expiresAt} > timezone('utc', clock_timestamp())`,
			),
		)
		.limit(1);
	if (
		!row?.active ||
		!row.authMigratedAt ||
		row.lifecycleState !== "normal" ||
		!row.candidateEmail ||
		row.sourceEmail !== row.currentEmail
	) {
		return "unusable";
	}
	return normalizeEmail(row.candidateEmail) === normalizeEmail(row.currentEmail)
		? "current"
		: "change";
}

/** Consume one challenge, checking the original and proposed addresses again. */
export async function completeEmailVerification(
	db: Db,
	token: string,
	mode: EmailVerificationMode,
	expectedUserId?: number,
): Promise<void> {
	const changedUserId = await db.transaction(async (tx) => {
		const [target] = await tx
			.select({ userId: setupTokens.userId })
			.from(setupTokens)
			.where(
				and(
					eq(setupTokens.tokenHash, hashToken(token)),
					eq(setupTokens.purpose, "email_verification"),
				),
			)
			.limit(1);
		if (
			!target ||
			(expectedUserId !== undefined && expectedUserId !== target.userId)
		) {
			throw new SetupCredentialError();
		}
		await lockUserSetupCredentials(tx, target.userId);
		const [challenge] = await tx
			.select({ sourceEmail: setupTokens.sourceEmail })
			.from(setupTokens)
			.where(eq(setupTokens.tokenHash, hashToken(token)))
			.limit(1);
		const consumed = await consumeSetupToken(tx, token, "email_verification");
		if (!consumed.candidateEmail || challenge?.sourceEmail === null) {
			throw new SetupCredentialError();
		}
		const [user] = await tx
			.select({
				active: users.active,
				authMigratedAt: users.authMigratedAt,
				email: users.email,
				emailVerified: users.emailVerified,
				lifecycleState: users.lifecycleState,
			})
			.from(users)
			.where(eq(users.id, consumed.userId))
			.for("update")
			.limit(1);
		if (
			!user?.active ||
			!user.authMigratedAt ||
			user.lifecycleState !== "normal" ||
			user.email !== challenge?.sourceEmail
		) {
			throw new SetupCredentialError();
		}
		const candidateEmail = normalizeEmail(consumed.candidateEmail);
		const sameAddress = candidateEmail === normalizeEmail(user.email);
		if (
			(mode === "current") !== sameAddress ||
			(sameAddress && user.emailVerified)
		) {
			throw new SetupCredentialError();
		}
		await claimEmail(tx, consumed.userId, candidateEmail);
		await tx
			.update(users)
			.set({ email: candidateEmail, emailVerified: true })
			.where(eq(users.id, consumed.userId));
		await supersedeSetupTokens(tx, consumed.userId, "email_verification");
		if (!sameAddress) {
			await Promise.all([
				supersedeSetupTokens(tx, consumed.userId, "password_recovery"),
				supersedeSetupTokens(tx, consumed.userId, "administrator_recovery"),
			]);
		}
		return consumed.userId;
	});
	await emit("users", changedUserId, "update");
}
