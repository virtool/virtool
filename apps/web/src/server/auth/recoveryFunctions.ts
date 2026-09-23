import { createHmac } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { PasswordTooShortError } from "@virtool/contracts";
import {
	beginEmailVerification,
	completeEmailVerification,
	EmailVerificationError,
	EmailVerificationRateLimitedError,
	EmailVerificationUnavailableError,
	inspectEmailVerificationLink,
} from "@virtool/data/auth/emailVerification";
import { EmailInUseError } from "@virtool/data/auth/lifecycle";
import { verifyPassword } from "@virtool/data/auth/password";
import {
	completePasswordRecovery,
	getSelfServiceRecoveryTarget,
	inspectRecoveryLink,
	issueRecoveryLink,
	RecoveryDeliveryUnavailableError,
	RecoveryNotEligibleError,
	RecoveryPasswordReuseError,
	revokeAdministratorRecoveryLinks,
} from "@virtool/data/auth/recovery";
import { checkRecoveryRequestBudget } from "@virtool/data/auth/recoveryRateLimit";
import { SetupCredentialError } from "@virtool/data/auth/setup";
import { users } from "@virtool/data/db/schema/users";
import {
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, keyring } from "../composition";
import { config } from "../config";
import { ClientError } from "../errors";
import { rowIdSchema } from "../validation";
import { PROTECTED_OPERATIONS } from "./freshness";
import { getClientIp } from "./ip";
import { requireAdminRole } from "./middleware";
import {
	adminRole,
	authenticated,
	open,
	recentlyAuthenticated,
} from "./policy";
import { checkConfiguredPasswordLength } from "./service";

const tokenSchema = z.string().max(256);
const recoveryRequestSchema = z.object({ handle: z.string().trim().max(128) });
const recoveryCompletionSchema = z.object({
	token: tokenSchema,
	password: z.string(),
	purpose: z.enum(["password_recovery", "administrator_recovery"]),
});
const emailChallengeSchema = z.object({ email: z.string().trim().max(254) });
const emailTokenSchema = z.object({ token: tokenSchema });
const recoveryTokenSchema = z.object({
	token: tokenSchema,
	purpose: z.enum(["password_recovery", "administrator_recovery"]),
});
const userIdSchema = z.object({ userId: rowIdSchema });

const TIMING_DUMMY_HASH = Buffer.from(
	"$2b$12$VJ/Rqk01lYZEyqA8ue4PAuuApLBrZoE.HmhYg6b5uPOrDh3huVNB.",
	"utf8",
);

function getDeliveryAvailable(
	settings: Awaited<ReturnType<typeof getEmailSettings>>,
): boolean {
	return (
		settings.enabled &&
		resolveEmailDelivery(settings, keyring).availability === "ready"
	);
}

function digestRecoveryBudget(value: string): string {
	return createHmac("sha256", config.authSecret).update(value).digest("hex");
}

function getPublicLink(path: string, token: string, purpose?: string): string {
	const url = new URL(path, config.publicOrigin);
	const fragment = new URLSearchParams({ token });
	if (purpose) {
		fragment.set("purpose", purpose);
	}
	url.hash = fragment.toString();
	return url.toString();
}

function rethrowVerificationError(error: unknown): never {
	if (error instanceof EmailVerificationRateLimitedError) {
		setResponseStatus(429);
		throw new ClientError(
			"Wait before requesting another verification email.",
			429,
		);
	}
	if (error instanceof EmailVerificationUnavailableError) {
		setResponseStatus(503);
		throw new ClientError("Email verification is unavailable right now.", 503);
	}
	if (
		error instanceof EmailVerificationError ||
		error instanceof EmailInUseError
	) {
		setResponseStatus(400);
		throw new ClientError("This email address cannot be verified.", 400);
	}
	throw error;
}

/** Start a pending account-email change without replacing the current address. */
export const requestAccountEmailChangeFn = createServerFn({ method: "POST" })
	.middleware([recentlyAuthenticated(PROTECTED_OPERATIONS.accountEmailChange)])
	.validator(emailChallengeSchema)
	.handler(async ({ context, data }) => {
		try {
			const settings = await getEmailSettings(db);
			return await beginEmailVerification(db, {
				userId: context.principal.userId,
				email: data.email,
				deliveryAvailable: getDeliveryAvailable(settings),
				getVerificationUrl: (token) => getPublicLink("/verify-email", token),
			});
		} catch (error) {
			rethrowVerificationError(error);
		}
	});

/** Verify a current email address using a mailbox bearer link. */
export const verifyCurrentEmailFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(emailTokenSchema)
	.handler(async ({ data }) => {
		try {
			await completeEmailVerification(db, data.token, "current");
			return { status: "verified" as const };
		} catch (error) {
			if (
				error instanceof SetupCredentialError ||
				error instanceof EmailInUseError
			) {
				return { status: "unusable" as const };
			}
			throw error;
		}
	});

/** Inspect a verification link without exposing an address or user. */
export const inspectEmailVerificationFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(emailTokenSchema)
	.handler(async ({ data }) => ({
		status: await inspectEmailVerificationLink(db, data.token),
	}));

/** Complete a pending address change for the current authenticated account. */
export const completeAccountEmailChangeFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(emailTokenSchema)
	.handler(async ({ context, data }) => {
		try {
			await completeEmailVerification(
				db,
				data.token,
				"change",
				context.principal.userId,
			);
			return { status: "verified" as const };
		} catch (error) {
			if (
				error instanceof SetupCredentialError ||
				error instanceof EmailInUseError
			) {
				return { status: "unusable" as const };
			}
			throw error;
		}
	});

/** Acknowledge every public recovery request identically. */
export const requestPasswordRecoveryFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(recoveryRequestSchema)
	.handler(async ({ data }) => {
		const handle = data.handle.trim().toLowerCase();
		const requesterDigest = digestRecoveryBudget(`requester:${getClientIp()}`);
		const targetDigest = digestRecoveryBudget(`target:${handle}`);
		const [allowed, settings] = await Promise.all([
			checkRecoveryRequestBudget(db, requesterDigest, targetDigest),
			getEmailSettings(db),
		]);
		await verifyPassword(handle, TIMING_DUMMY_HASH);
		if (allowed && getDeliveryAvailable(settings)) {
			const userId = await getSelfServiceRecoveryTarget(db, handle);
			if (userId !== null) {
				try {
					await issueRecoveryLink(db, {
						userId,
						purpose: "password_recovery",
						deliveryAvailable: true,
						getRecoveryUrl: (token) =>
							getPublicLink("/recover", token, "password_recovery"),
					});
				} catch (error) {
					if (
						!(error instanceof RecoveryNotEligibleError) &&
						!(error instanceof RecoveryDeliveryUnavailableError)
					) {
						throw error;
					}
				}
			}
		}
		return { status: "accepted" as const };
	});

/** Change a password by a purpose-bound recovery bearer token. */
export const completePasswordRecoveryFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(recoveryCompletionSchema)
	.handler(async ({ data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);
			await completePasswordRecovery(
				db,
				data.token,
				data.purpose,
				data.password,
			);
			return { status: "password_changed" as const, next: "login" as const };
		} catch (error) {
			if (error instanceof PasswordTooShortError) {
				setResponseStatus(400);
				throw new ClientError(error.message, 400);
			}
			if (error instanceof RecoveryPasswordReuseError) {
				setResponseStatus(400);
				throw new ClientError("Choose a different password.", 400);
			}
			if (error instanceof SetupCredentialError) {
				return { status: "unusable" as const };
			}
			throw error;
		}
	});

/** Inspect a recovery link without exposing account state. */
export const inspectPasswordRecoveryFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(recoveryTokenSchema)
	.handler(async ({ data }) => ({
		status: await inspectRecoveryLink(db, data.token, data.purpose),
	}));

/** Issue a one-time administrator recovery URL for an eligible user. */
export const issueAdministratorRecoveryFn = createServerFn({ method: "POST" })
	.middleware([
		adminRole("users"),
		recentlyAuthenticated(PROTECTED_OPERATIONS.recoveryLinkIssue),
	])
	.validator(userIdSchema)
	.handler(async ({ context, data }) => {
		const [target] = await db
			.select({ administratorRole: users.administratorRole })
			.from(users)
			.where(eq(users.id, data.userId))
			.limit(1);
		if (target?.administratorRole) {
			await requireAdminRole(context.principal, "full");
		}
		const settings = await getEmailSettings(db);
		try {
			const issued = await issueRecoveryLink(db, {
				userId: data.userId,
				purpose: "administrator_recovery",
				issuerUserId: context.principal.userId,
				deliveryAvailable: getDeliveryAvailable(settings),
				getRecoveryUrl: (token) =>
					getPublicLink("/recover", token, "administrator_recovery"),
			});
			return {
				url: getPublicLink("/recover", issued.token, "administrator_recovery"),
				expiresAt: issued.expiresAt,
				delivery: issued.delivery,
			};
		} catch (error) {
			if (error instanceof RecoveryNotEligibleError) {
				setResponseStatus(400);
				throw new ClientError(
					"A recovery link cannot be issued for this user.",
					400,
				);
			}
			throw error;
		}
	});

/** Revoke every outstanding administrator recovery URL for a user. */
export const revokeAdministratorRecoveryFn = createServerFn({ method: "POST" })
	.middleware([
		adminRole("users"),
		recentlyAuthenticated(PROTECTED_OPERATIONS.recoveryLinkIssue),
	])
	.validator(userIdSchema)
	.handler(async ({ context, data }) => {
		const [target] = await db
			.select({ administratorRole: users.administratorRole })
			.from(users)
			.where(eq(users.id, data.userId))
			.limit(1);
		if (target?.administratorRole) {
			await requireAdminRole(context.principal, "full");
		}
		await revokeAdministratorRecoveryLinks(db, data.userId);
		return null;
	});
