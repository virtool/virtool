import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { authAccounts, authTwoFactors } from "@virtool/data/db/schema/auth";
import { APIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../composition";
import { ClientError } from "../errors";
import {
	attributePrincipal,
	ForbiddenError,
	UnauthorizedError,
} from "./middleware";
import { authenticated } from "./policy";

const challengeSchema = z.discriminatedUnion("method", [
	z.object({ method: z.literal("password"), password: z.string().min(1) }),
	z.object({ method: z.literal("totp"), code: z.string().trim().min(1) }),
]);

function rejectUnsupportedSession(): never {
	setResponseStatus(403);
	throw new ForbiddenError();
}

function rethrowChallengeError(err: unknown): never {
	if (err instanceof APIError && err.statusCode < 500) {
		const status = err.statusCode === 429 ? 429 : 400;
		setResponseStatus(status);
		throw new ClientError("Authentication challenge failed.", status);
	}
	throw err;
}

function rethrowReplacementError(err: unknown): never {
	if (
		err instanceof APIError &&
		err.statusCode === 401 &&
		err.body?.code === "STEP_UP_SESSION_ENDED"
	) {
		setResponseStatus(409);
		throw new ClientError("Authentication challenge expired.", 409);
	}
	if (err instanceof APIError && err.statusCode === 401) {
		setResponseStatus(401);
		throw new UnauthorizedError();
	}
	throw err;
}

/** Return the non-secret step-up methods enrolled for the current account. */
export const getRecentAuthenticationMethodsFn = createServerFn({
	method: "GET",
})
	.middleware([authenticated()])
	.handler(async ({ context }) => {
		if (context.principal.sessionStore !== "better_auth") {
			rejectUnsupportedSession();
		}

		const [passwordAccount, twoFactor] = await Promise.all([
			db
				.select({ id: authAccounts.id })
				.from(authAccounts)
				.where(
					and(
						eq(authAccounts.userId, context.principal.userId),
						eq(authAccounts.providerId, "credential"),
						isNotNull(authAccounts.password),
					),
				)
				.limit(1),
			db
				.select({ id: authTwoFactors.id })
				.from(authTwoFactors)
				.where(
					and(
						eq(authTwoFactors.userId, context.principal.userId),
						eq(authTwoFactors.verified, true),
					),
				)
				.limit(1),
		]);

		return {
			password: passwordAccount.length === 1,
			totp: twoFactor.length === 1,
		};
	});

/** Verify one native Better Auth challenge and rotate the browser session. */
export const challengeRecentAuthenticationFn = createServerFn({
	method: "POST",
})
	.middleware([authenticated()])
	.validator(challengeSchema)
	.handler(async ({ context, data }) => {
		if (context.principal.sessionStore !== "better_auth") {
			rejectUnsupportedSession();
		}

		const [{ auth }, request] = await Promise.all([
			import("./instance"),
			Promise.resolve(getRequest()),
		]);

		try {
			if (data.method === "password") {
				await auth.api.verifyPassword({
					headers: request.headers,
					body: { password: data.password },
				});
			} else {
				await auth.api.verifyTOTP({
					headers: request.headers,
					body: { code: data.code, trustDevice: false },
				});
			}
		} catch (err) {
			return rethrowChallengeError(err);
		}

		try {
			const replacement = await auth.api.createStepUpSession({
				headers: request.headers,
			});
			const sessionId = Number(replacement.sessionId);
			if (!Number.isSafeInteger(sessionId)) {
				throw new Error(
					"Better Auth returned an invalid replacement session id",
				);
			}

			attributePrincipal({
				kind: "browser",
				userId: context.principal.userId,
				sessionId,
				createdAt: replacement.createdAt,
				sessionStore: "better_auth",
			});

			return {
				createdAt: replacement.createdAt,
				sessionId,
			};
		} catch (err) {
			return rethrowReplacementError(err);
		}
	});
