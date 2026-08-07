import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { PasswordTooShortError } from "@virtool/contracts";
import { z } from "zod";
import { db } from "../composition";
import { ClientError } from "../errors";
import { realCookies } from "./cookies";
import {
	createFirstUser,
	FirstUserExistsError,
	InvalidCredentialsError,
	InvalidResetSessionError,
	login,
	logout,
	PasswordReuseError,
	resetPassword,
} from "./core";
import { getClientIp } from "./ip";
import { open } from "./policy";
import { checkConfiguredPasswordLength } from "./service";

// `password` is deliberately not length-checked here. Login authenticates an
// existing credential rather than setting a new one, and rejecting a short
// stored password would lock the user out of the reset flow that fixes it.
const loginSchema = z.object({
	handle: z.string().min(1),
	password: z.string().min(1),
	remember: z.boolean().default(false),
});

// Length is enforced by checkConfiguredPasswordLength in the handlers below, not
// here — see that function for why the validator is the wrong place for it.
const resetPasswordSchema = z.object({
	password: z.string(),
	resetCode: z.string().min(1),
});

const createFirstUserSchema = z.object({
	handle: z.string().trim().min(1),
	password: z.string(),
});

/** Login server function. Unauthenticated by necessity — this *creates* the session. */
export const loginFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(loginSchema)
	.handler(async ({ data }) => {
		try {
			const result = await login(db, realCookies, {
				handle: data.handle,
				password: data.password,
				remember: data.remember,
				ip: getClientIp(),
			});

			if (result.status === "reset_required") {
				setResponseStatus(200);
				return { reset: true as const, resetCode: result.resetCode };
			}

			setResponseStatus(201);
			return { reset: false as const };
		} catch (err) {
			if (err instanceof InvalidCredentialsError) {
				setResponseStatus(400);
				throw new ClientError("Invalid handle or password.");
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
		try {
			await checkConfiguredPasswordLength(db, data.password);

			const user = await createFirstUser(db, realCookies, {
				handle: data.handle,
				password: data.password,
				ip: getClientIp(),
			});
			setResponseStatus(201);
			return user;
		} catch (err) {
			if (err instanceof PasswordTooShortError) {
				setResponseStatus(400);
				throw new ClientError(err.message);
			}
			if (err instanceof FirstUserExistsError) {
				setResponseStatus(409);
				throw new ClientError("Virtool already has a user.");
			}
			throw err;
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
		await logout(db, realCookies);
		Sentry.setUser(null);
		return null;
	});

/**
 * Reset-password server function. Unauthenticated by necessity — this is the
 * forced-reset flow that runs before the user has a session. Authorization is
 * carried by the `resetCode` returned from `loginFn`.
 */
export const resetPasswordFn = createServerFn({ method: "POST" })
	.middleware([open()])
	.validator(resetPasswordSchema)
	.handler(async ({ data }) => {
		try {
			await checkConfiguredPasswordLength(db, data.password);

			await resetPassword(db, realCookies, {
				password: data.password,
				resetCode: data.resetCode,
				ip: getClientIp(),
			});
			setResponseStatus(200);
			return { login: false as const, reset: false as const };
		} catch (err) {
			if (err instanceof PasswordTooShortError) {
				setResponseStatus(400);
				throw new ClientError(err.message);
			}
			if (err instanceof InvalidResetSessionError) {
				setResponseStatus(400);
				throw new ClientError("Invalid session");
			}
			if (err instanceof PasswordReuseError) {
				setResponseStatus(400);
				throw new ClientError("Cannot reuse current password");
			}
			throw err;
		}
	});
