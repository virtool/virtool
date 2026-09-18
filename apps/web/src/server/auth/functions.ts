import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import {
	EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS,
	PasswordTooShortError,
} from "@virtool/contracts";
import {
	cancelEmailRemediation,
	changeEmailRemediation,
	checkEmailRemediationComplete,
	claimEmailRemediationPromotion,
	completeEmailRemediation,
	EmailInUseError,
	EmailRemediationRateLimitedError,
	getEmailRemediationState,
	resendEmailRemediation,
	SetupNotEligibleError,
	startEmailRemediation,
	verifyEmailRemediationToken,
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
import { UnauthorizedError } from "./middleware";
import { authenticated, open, passwordResetOnly, setupOnly } from "./policy";
import { resolveRestrictedSetup } from "./restricted";
import { checkConfiguredPasswordLength } from "./service";
import {
	createReplacementSession,
	signInUsername,
	signOut,
	verifyTwoFactor,
} from "./sessionActions";
import { verifyBrowserPrincipal } from "./verify";

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

function extendEmailRemediationCookies(sessionId: string) {
	const token = realCookies.getSetupSessionToken();
	if (!token) {
		throw new SetupCredentialError();
	}
	realCookies.setSetupSession(
		sessionId,
		token,
		EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS * 60 * 60,
	);
}

const createFirstUserSchema = z.object({
	handle: z.string().trim().min(1),
	password: z.string(),
});

const emailRemediationSchema = z.object({
	email: z.string().trim().min(1).max(254),
	redirect: z.string().max(2048).optional(),
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
	if (err instanceof EmailRemediationRateLimitedError) {
		setResponseStatus(429);
		throw new ClientError(
			"Wait before sending another verification email.",
			429,
		);
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

/** Revalidate the established shell and allow Better Auth to roll its session. */
export const refreshBrowserSessionFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.handler(async ({ context }) => {
		if (context.principal.sessionStore === "legacy") {
			return null;
		}

		const { auth } = await import("./instance");
		const session = await auth.api.getSession({
			headers: getRequest().headers,
			query: { disableCookieCache: true },
		});
		if (!session) {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}
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
	setupSessionId: string,
	token: string,
	verified: boolean,
) {
	const user = await completeEmailRemediation(db, {
		token,
		userId,
		verified,
	});
	if (
		!(await claimEmailRemediationPromotion(
			db,
			user.id,
			setupSessionId,
			verified,
		))
	) {
		throw new SetupCredentialError();
	}
	realCookies.clearLegacySession();
	realCookies.clearSetup();
	await createReplacementSession(user.id);
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
					getRemediationVerificationUrl(token, data.redirect),
				setupSessionId: context.principal.sessionId,
				userId: context.principal.userId,
			});

			if (result.status === "verification_required") {
				extendEmailRemediationCookies(context.principal.sessionId);
				return {
					complete: false as const,
					state: await getEmailRemediationState(db, context.principal.userId),
				};
			}

			return await finishEmailRemediation(
				context.principal.userId,
				context.principal.sessionId,
				result.token,
				false,
			);
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/** Spend a mailbox challenge without requiring or granting browser authority. */
export const completeEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(emailRemediationTokenSchema)
	.handler(async ({ data }) => {
		try {
			const request = getRequest();
			const [setup, browser, result] = await Promise.all([
				resolveRestrictedSetup(request),
				verifyBrowserPrincipal(db, request),
				verifyEmailRemediationToken(db, data.token),
			]);
			let authenticated =
				browser !== null &&
				browser !== undefined &&
				result.userId !== undefined &&
				browser.userId === result.userId;
			if (
				!authenticated &&
				result.userId &&
				setup?.purpose === "email_remediation" &&
				setup.userId === result.userId &&
				(result.status === "verified" || result.status === "already_verified")
			) {
				const claimed = await claimEmailRemediationPromotion(
					db,
					result.userId,
					setup.sessionId,
				);
				if (claimed) {
					await createReplacementSession(result.userId);
					realCookies.clearLegacySession();
					realCookies.clearSetup();
					authenticated = true;
				}
			}
			return {
				status: result.status,
				authenticated,
				canRetry:
					setup?.purpose === "email_remediation" &&
					setup.userId === result.userId,
			};
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

function getRemediationVerificationUrl(token: string, redirect?: string) {
	const fragment = new URLSearchParams({ token });
	if (redirect) {
		fragment.set("redirect", redirect);
	}
	return `${config.publicOrigin}/email-remediation-verify#${fragment}`;
}

/** Send a replacement mailbox challenge for the staged address. */
export const resendEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.validator(z.object({ redirect: z.string().max(2048).optional() }))
	.handler(async ({ context, data }) => {
		try {
			const settings = await getEmailSettings(db);
			const delivery = resolveEmailDelivery(settings, keyring);
			const result = await resendEmailRemediation(db, {
				deliveryAvailable:
					settings.enabled && delivery.availability === "ready",
				getVerificationUrl: (token) =>
					getRemediationVerificationUrl(token, data.redirect),
				setupSessionId: context.principal.sessionId,
				userId: context.principal.userId,
			});
			if (result.status === "offline") {
				return await finishEmailRemediation(
					context.principal.userId,
					context.principal.sessionId,
					result.token,
					false,
				);
			}
			extendEmailRemediationCookies(context.principal.sessionId);
			return {
				complete: false as const,
				state: await getEmailRemediationState(db, context.principal.userId),
			};
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/** Discard the staged address while retaining the restricted login proof. */
export const changeEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.handler(async ({ context }) => {
		await changeEmailRemediation(db, context.principal.userId);
		return { status: "input" as const };
	});

/** Finish a remediation that was verified in another browser. */
export const promoteEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.handler(async ({ context }) => {
		try {
			await checkEmailRemediationComplete(db, context.principal.userId);
			if (
				!(await claimEmailRemediationPromotion(
					db,
					context.principal.userId,
					context.principal.sessionId,
				))
			) {
				throw new SetupCredentialError();
			}
			await createReplacementSession(context.principal.userId);
			realCookies.clearLegacySession();
			realCookies.clearSetup();
			return { complete: true as const };
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

/** Revoke the pending challenge and abandon restricted remediation. */
export const cancelEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.handler(async ({ context }) => {
		await cancelEmailRemediation(db, context.principal.userId);
		realCookies.clearLegacySession();
		realCookies.clearSetup();
		return null;
	});
