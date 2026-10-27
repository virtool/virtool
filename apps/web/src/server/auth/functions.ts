import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS,
	INVALID_EMAIL_MESSAGE,
	isValidEmail,
	normalizeEmail,
	PasswordTooShortError,
} from "@virtool/contracts";
import { upgradePasswordHash } from "@virtool/data/auth/credential";
import {
	AccountSetupHandleInUseError,
	cancelEmailRemediation,
	changeEmailRemediation,
	checkEmailRemediationComplete,
	claimEmailRemediationPromotion,
	completeAccountSetup,
	completeEmailRemediation,
	EmailInUseError,
	EmailRemediationRateLimitedError,
	getEmailRemediationState,
	inspectAccountSetup,
	resendEmailRemediation,
	SetupNotEligibleError,
	startEmailRemediation,
	verifyEmailRemediationToken,
} from "@virtool/data/auth/lifecycle";
import { SetupCredentialError } from "@virtool/data/auth/setup";
import { users } from "@virtool/data/db/schema/users";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordAccountLifecycle } from "../accountLifecycleTelemetry";
import { db } from "../composition";
import { config } from "../config";
import {
	getPublicLink,
	getVerificationUrl,
	isEmailDeliveryAvailable,
} from "../email/delivery";
import { ClientError } from "../errors";
import { logger } from "../logger";
import { getLoginDevices, realCookies, setLoginDevices } from "./cookies";
import {
	createFirstUser,
	FirstUserExistsError,
	InvalidCredentialsError,
	loginLegacyIdentity,
	logout,
	PasswordReuseError,
	resetPassword,
} from "./core";
import { checkHandle, checkReservedHandle } from "./handle";
import { getClientIp } from "./ip";
import {
	checkLoginBudget,
	clearLoginFailures,
	LOGIN_DEVICE_LIFETIME_SECONDS,
	type LoginAttempt,
	type LoginBudget,
	LoginRateLimitedError,
	rememberLoginDevice,
} from "./loginRateLimit";
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
	email: z.string().trim().min(1).max(254),
	password: z.string(),
});

const accountSetupSchema = z.object({
	token: z.string().regex(/^[0-9a-f]{64}$/),
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
	if (err instanceof LoginRateLimitedError) {
		throw new ClientError(
			"Too many sign-in attempts. Wait a moment and try again.",
			429,
		);
	}
	if (
		err instanceof InvalidCredentialsError ||
		(err instanceof APIError && err.statusCode < 500)
	) {
		throw new ClientError("Invalid handle or password.", 400);
	}
	if (err instanceof EmailRemediationRateLimitedError) {
		throw new ClientError(
			"Wait before sending another verification email.",
			429,
		);
	}
	if (err instanceof PasswordTooShortError) {
		throw new ClientError(err.message, 400);
	}
	if (err instanceof FirstUserExistsError) {
		throw new ClientError("Virtool already has a user.", 409);
	}
	if (err instanceof PasswordReuseError) {
		throw new ClientError("Cannot reuse current password", 400);
	}
	if (err instanceof EmailInUseError) {
		throw new ClientError("Another account uses this email address.", 409);
	}
	if (
		err instanceof SetupCredentialError ||
		err instanceof SetupNotEligibleError
	) {
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
			const ip = getClientIp();
			const attempt = {
				ip,
				handle: data.handle,
				devices: getLoginDevices(),
				secret: config.authSecret,
			};
			const budget = await checkLoginBudget(db, attempt);

			const legacy = await loginLegacyIdentity(db, realCookies, {
				handle: data.handle,
				password: data.password,
				ip,
			});
			if (legacy) {
				await Promise.all([
					settleLoginBudget(attempt, budget),
					upgradeLoginPasswordHash(data.handle, data.password),
				]);
				return legacy;
			}

			const result = await signInUsername(data.handle, data.password);
			await Promise.all([
				settleLoginBudget(attempt, budget),
				upgradeLoginPasswordHash(data.handle, data.password),
			]);

			if ("twoFactorRedirect" in result) {
				return { twoFactorRedirect: true as const };
			}

			return await completeLogin(Number(result.user.id));
		} catch (err) {
			rethrowAsHttp(err);
		}
	});

// A hash that stays outdated still verifies, so a failed upgrade must not fail
// the sign-in that the password has already passed.
async function upgradeLoginPasswordHash(handle: string, password: string) {
	try {
		await upgradePasswordHash(db, { handle, password });
	} catch (err) {
		logger.warn({ err }, "password hash upgrade failed");
	}
}

async function settleLoginBudget(attempt: LoginAttempt, budget: LoginBudget) {
	const [, devices] = await Promise.all([
		clearLoginFailures(db, budget),
		rememberLoginDevice(db, attempt),
	]);
	if (devices) {
		setLoginDevices(devices, LOGIN_DEVICE_LIFETIME_SECONDS);
	}
}

async function completeLogin(userId: number) {
	const [user] = await db
		.select({ forceReset: users.forceReset })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new APIError("UNAUTHORIZED");
	}

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
			rethrowTwoFactorError(err);
		}
	});

// A 410 or 429 ends the challenge, so the client returns to the sign-in form.
function rethrowTwoFactorError(err: unknown): never {
	if (!(err instanceof APIError) || err.statusCode >= 500) {
		throw err;
	}
	switch (err.body?.code) {
		case "INVALID_CODE":
			throw new ClientError(
				"The code is not correct. Enter the code your app shows now.",
				400,
			);
		case "INVALID_BACKUP_CODE":
			throw new ClientError("The recovery code is not correct.", 400);
		case "ACCOUNT_TEMPORARILY_LOCKED":
			throw new ClientError(
				"Too many incorrect codes. Wait a few minutes, then sign in again.",
				429,
			);
		case "INVALID_TWO_FACTOR_COOKIE":
		case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
			throw new ClientError("Your sign-in expired. Sign in again.", 410);
		default:
			throw new ClientError("The code could not be checked. Try again.", 400);
	}
}

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
		const email = normalizeEmail(data.email);
		if (!isValidEmail(email)) {
			throw new ClientError(INVALID_EMAIL_MESSAGE, 400);
		}
		await checkConfiguredPasswordLength(db, data.password).catch(rethrowAsHttp);

		try {
			const result = await createFirstUser(db, {
				handle: data.handle,
				email,
				password: data.password,
				deliveryAvailable: await isEmailDeliveryAvailable(),
				getVerificationUrl,
			});
			await signInUsername(data.handle, data.password);
			recordAccountLifecycle({
				operation: "bootstrap",
				outcome: "success",
				message: "first instance administrator created",
				userId: result.user.id,
			});
			return result;
		} catch (err) {
			recordAccountLifecycle({
				operation: "bootstrap",
				outcome: "failure",
				message: "first instance administrator creation failed",
			});
			rethrowAsHttp(err);
		}
	});

/** Inspect a public account-setup bearer token without consuming it. */
export const inspectAccountSetupFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(z.object({ token: accountSetupSchema.shape.token }))
	.handler(async ({ data }) => inspectAccountSetup(db, data.token));

/** Accept an invitation, establish its credential, and sign the user in. */
export const acceptAccountSetupFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(accountSetupSchema)
	.handler(async ({ data }) => {
		checkHandle(data.handle);
		checkReservedHandle(data.handle);
		await checkConfiguredPasswordLength(db, data.password).catch(rethrowAsHttp);

		try {
			const completed = await completeAccountSetup(db, {
				token: data.token,
				handle: data.handle,
				password: data.password,
				deliveryAvailable: await isEmailDeliveryAvailable(),
				getVerificationUrl,
			});
			await signInUsername(completed.user.handle, data.password);
			recordAccountLifecycle({
				operation: "invitation_accept",
				outcome: "success",
				message: "account invitation accepted",
				userId: completed.user.id,
			});
			return {
				user: completed.user,
				emailVerificationRequired: completed.emailVerificationRequired,
				nextRoute: "/" as const,
			};
		} catch (err) {
			recordAccountLifecycle({
				operation: "invitation_accept",
				outcome: "failure",
				message: "account invitation acceptance failed",
			});
			if (err instanceof AccountSetupHandleInUseError) {
				throw new ClientError("This username is already taken.", 409);
			}
			if (
				err instanceof SetupCredentialError ||
				err instanceof SetupNotEligibleError
			) {
				throw new ClientError("This account setup link cannot be used.", 400);
			}
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
	.handler(async () => {
		const { auth } = await import("./instance");
		const session = await auth.api.getSession({
			headers: getRequest().headers,
			query: { disableCookieCache: true },
		});
		if (!session) {
			throw new UnauthorizedError();
		}
		return null;
	});

/**
 * Reset-password server function. The caller has a Better Auth session
 * restricted until the password change is complete.
 */
export const resetPasswordFn = createServerFn({ method: "POST" })
	.middleware([passwordResetOnly()])
	.validator(resetPasswordSchema)
	.handler(async ({ context, data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);

			await resetPassword(db, {
				userId: context.principal.userId,
				password: data.password,
			});
			await createReplacementSession(context.principal.userId);
			return { login: false as const, reset: false as const };
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
		if (!isValidEmail(normalizeEmail(data.email))) {
			throw new ClientError(INVALID_EMAIL_MESSAGE, 400);
		}
		try {
			const result = await startEmailRemediation(db, {
				deliveryAvailable: await isEmailDeliveryAvailable(),
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
	return getPublicLink("/email-remediation-verify", { token, redirect });
}

/** Send a replacement mailbox challenge for the staged address. */
export const resendEmailRemediationFn = createServerFn({ method: "POST" })
	.middleware([setupOnly("email_remediation")])
	.validator(z.object({ redirect: z.string().max(2048).optional() }))
	.handler(async ({ context, data }) => {
		try {
			const result = await resendEmailRemediation(db, {
				deliveryAvailable: await isEmailDeliveryAvailable(),
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
		realCookies.clearSetup();
		return null;
	});
