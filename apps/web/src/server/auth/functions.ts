import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { PasswordTooShortError } from "@virtool/contracts";
import {
	completeEmailRemediation,
	EmailInUseError,
	getEmailRemediationState,
	SetupNotEligibleError,
	startEmailRemediation,
} from "@virtool/data/auth/lifecycle";
import { SetupCredentialError } from "@virtool/data/auth/setup";
import { users } from "@virtool/data/db/schema/users";
import {
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, keyring } from "../composition";
import { config } from "../config";
import { ClientError } from "../errors";
import { realCookies } from "./cookies";
import {
	createFirstUser,
	establishEmailRemediationSession,
	FirstUserExistsError,
	InvalidCredentialsError,
	loginLegacyIdentity,
	logout,
	PasswordReuseError,
	resetPassword,
} from "./core";
import { checkHandle, checkReservedHandle } from "./handle";
import { getClientIp } from "./ip";
import { open, passwordResetOnly, setupOnly } from "./policy";
import { checkConfiguredPasswordLength } from "./service";
import {
	createRemediationSession,
	signInUsername,
	signOut,
	verifyTwoFactor,
} from "./sessionActions";

// `password` is deliberately not length-checked here. Login authenticates an
// existing credential rather than setting a new one, and rejecting a short
// stored password would lock the user out of the reset flow that fixes it.
const loginSchema = z.object({
	handle: z.string().min(1),
	password: z.string().min(1),
});

// Length is enforced by checkConfiguredPasswordLength in the handlers below, not
// here — see that function for why the validator is the wrong place for it.
const resetPasswordSchema = z.object({
	password: z.string(),
});

const createFirstUserSchema = z.object({
	handle: z.string().trim().min(1),
	password: z.string(),
});

const emailRemediationSchema = z.object({
	email: z.string().trim().min(1).max(254),
});

const emailRemediationTokenSchema = z.object({
	token: z.string().regex(/^[0-9a-f]{64}$/),
});

function rethrowAsHttp(err: unknown): never {
	if (
		err instanceof InvalidCredentialsError ||
		(err instanceof APIError && err.statusCode < 500)
	) {
		setResponseStatus(400);
		throw new ClientError("Invalid handle or password.", 400);
	}
	if (err instanceof PasswordTooShortError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	if (err instanceof FirstUserExistsError) {
		setResponseStatus(409);
		throw new ClientError("Virtool already has a user.", 409);
	}
	if (err instanceof PasswordReuseError) {
		setResponseStatus(400);
		throw new ClientError("Cannot reuse current password", 400);
	}
	if (
		err instanceof EmailInUseError ||
		err instanceof SetupCredentialError ||
		err instanceof SetupNotEligibleError
	) {
		setResponseStatus(400);
		throw new ClientError("Email remediation could not be completed.", 400);
	}
	throw err;
}

/** Login server function. Unauthenticated by necessity — this *creates* the session. */
export const loginFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(loginSchema)
	.handler(async ({ data }) => {
		try {
			const legacy = await loginLegacyIdentity(db, realCookies, {
				handle: data.handle,
				password: data.password,
				ip: getClientIp(),
			});
			if (legacy) {
				setResponseStatus(201);
				return legacy;
			}

			const result = await signInUsername(data.handle, data.password);

			if ("twoFactorRedirect" in result) {
				return { twoFactorRedirect: true as const };
			}

			return await completeLogin(Number(result.user.id));
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

async function completeLogin(userId: number) {
	const [user] = await db
		.select({ forceReset: users.forceReset })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new APIError("UNAUTHORIZED");
	}

	setResponseStatus(201);
	return { reset: user.forceReset };
}

/** Complete a login using Better Auth's pending two-factor challenge cookie. */
export const verifyTwoFactorFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(
		z.object({ code: z.string().trim().min(1), recovery: z.boolean() }),
	)
	.handler(async ({ data }) => {
		try {
			const result = await verifyTwoFactor(data.code, data.recovery);
			return await completeLogin(Number(result.user.id));
		} catch (err) {
			if (err instanceof APIError && err.statusCode < 500) {
				setResponseStatus(400);
				throw new ClientError(
					"Invalid or expired verification code. Try again or restart login.",
					400,
				);
			}
			throw err;
		}
	});

/**
 * First-user setup server function. Unauthenticated by necessity — it runs
 * before any user (and therefore any session) exists, and it establishes the
 * session for the user it creates.
 */
export const createFirstUserFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(createFirstUserSchema)
	.handler(async ({ data }) => {
		checkHandle(data.handle);
		checkReservedHandle(data.handle);

		try {
			await checkConfiguredPasswordLength(db, data.password);

			const user = await createFirstUser(db, {
				handle: data.handle,
				password: data.password,
			});
			await signInUsername(data.handle, data.password);
			setResponseStatus(201);
			return user;
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/**
 * Logout server function. Unauthenticated by necessity, and idempotent — a
 * caller whose session has already expired still needs its stale cookies
 * cleared, and refusing them with a 401 would strand the browser holding
 * credentials it cannot use. `logout` invalidates the session only if the
 * cookie names one, then clears the cookies either way.
 */
export const logoutFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.handler(async () => {
		await signOut();
		await logout(db, realCookies);
		Sentry.setUser(null);
		return null;
	});

/**
 * Reset-password server function. The caller has a Better Auth or retained
 * legacy reset session restricted until the password change is complete.
 */
export const resetPasswordFn = createServerFn({ method: "POST" })
	.middleware([passwordResetOnly()])
	.validator(resetPasswordSchema)
	.handler(async ({ context, data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);

			const result = await resetPassword(db, {
				userId: context.principal.userId,
				password: data.password,
				legacySessionId: realCookies.getSessionId(),
			});

			if (result.migrated) {
				await signInUsername(result.handle, data.password);
			} else {
				await establishEmailRemediationSession(
					db,
					realCookies,
					context.principal.userId,
					getClientIp(),
				);
			}
			setResponseStatus(200);
			return {
				login: false as const,
				remediation: !result.migrated,
				reset: false as const,
			};
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

async function finishEmailRemediation(
	userId: number,
	token: string,
	verified: boolean,
) {
	const user = await completeEmailRemediation(db, {
		token,
		userId,
		verified,
	});
	realCookies.clearLegacySession();
	realCookies.clearSetup();
	await createRemediationSession(user.id);
	return { complete: true as const };
}

/** Read resumable state for the restricted email-remediation wall. */
export const getEmailRemediationFn = createServerFn({ method: "GET" })
	.middleware([setupOnly("email_remediation")])
	.handler(async ({ context }) => {
		try {
			return await getEmailRemediationState(db, context.principal.userId);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/** Stage an address, then verify it by mail or complete under offline policy. */
export const submitEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.validator(emailRemediationSchema)
	.handler(async ({ context, data }) => {
		try {
			const settings = await getEmailSettings(db);
			const delivery = resolveEmailDelivery(settings, keyring);
			const result = await startEmailRemediation(db, {
				deliveryAvailable:
					settings.enabled && delivery.availability === "ready",
				email: data.email,
				getVerificationUrl: (token) =>
					`${config.publicOrigin}/email-remediation-verify?token=${encodeURIComponent(token)}`,
				userId: context.principal.userId,
			});

			if (result.status === "verification_required") {
				return { complete: false as const };
			}

			return await finishEmailRemediation(
				context.principal.userId,
				result.token,
				false,
			);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/** Spend the mailbox challenge and finish a restricted email remediation. */
export const completeEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.validator(emailRemediationTokenSchema)
	.handler(async ({ context, data }) => {
		try {
			return await finishEmailRemediation(
				context.principal.userId,
				data.token,
				true,
			);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});
