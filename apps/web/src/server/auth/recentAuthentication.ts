import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { authAccounts, authTwoFactors } from "@virtool/data/db/schema/auth";
import { APIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../composition";
import { ClientError } from "../errors";
import { AUTH_BASE_PATH } from "./betterAuth";
import {
	attributePrincipal,
	ForbiddenError,
	UnauthorizedError,
} from "./middleware";
import { authenticated } from "./policy";
import {
	RECENT_AUTHENTICATION_PATH,
	recentAuthenticationChallengeSchema,
} from "./recentAuthenticationChallenge";

function rejectUnsupportedSession(): never {
	setResponseStatus(403);
	throw new ForbiddenError();
}

async function checkChallengeResponse(response: Response): Promise<void> {
	if (response.ok) {
		return;
	}
	if (response.status === 401) {
		const body = await response.json();
		if (body.code === "UNAUTHORIZED") {
			setResponseStatus(401);
			throw new UnauthorizedError();
		}
	}
	if (response.status >= 500) {
		throw new Error("Authentication challenge provider failed.");
	}
	const status = response.status === 429 ? 429 : 400;
	setResponseStatus(status);
	throw new ClientError("Authentication challenge failed.", status);
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
	.validator(recentAuthenticationChallengeSchema)
	.handler(async ({ context, data }) => {
		if (context.principal.sessionStore !== "better_auth") {
			rejectUnsupportedSession();
		}

		const [{ auth, handleAuthRequest }, request] = await Promise.all([
			import("./instance"),
			Promise.resolve(getRequest()),
		]);

		const headers = new Headers(request.headers);
		headers.set("content-type", "application/json");
		headers.delete("content-length");
		await checkChallengeResponse(
			await handleAuthRequest(
				new Request(
					new URL(
						`${AUTH_BASE_PATH}${RECENT_AUTHENTICATION_PATH}`,
						request.url,
					),
					{ method: "POST", headers, body: JSON.stringify(data) },
				),
			),
		);

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
