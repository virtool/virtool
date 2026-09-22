import { passkey } from "@better-auth/passkey";
import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import type { Db } from "@virtool/data/db/pg";
import {
	authAccounts,
	authPasskeys,
	authRateLimits,
	authSessions,
	authTwoFactors,
	authVerifications,
} from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	APIError,
	createAuthEndpoint,
	createAuthMiddleware,
	sensitiveSessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { twoFactor, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { SESSION_FRESH_AGE_SECONDS } from "./freshness";
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, isValidHandle } from "./handle";
import { recentAuthenticationPlugin } from "./recentAuthenticationChallenge";
import { normalizeBrowserSessionMetadata } from "./sessionMetadata";

/** Where the Better Auth handler is mounted. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * The endpoints this instance refuses.
 *
 * `/sign-in/email`: `emailAndPassword` is enabled for its password hashing, but
 * it also mounts this, and `disableSignUp` does not take it down. Virtool signs
 * in by handle: `users.email` carries no unique constraint and duplicate
 * addresses exist, so an email lookup would resolve to an arbitrary one of the
 * holders.
 *
 * `/is-username-available`: the `username` plugin mounts this unauthenticated,
 * and Virtool has no public sign-up for it to serve. It would answer whether a
 * handle exists — the enumeration the sign-in paths are shaped to withhold.
 *
 * `/update-user`: with the `username` plugin registered this writes `username`
 * and `displayUsername` straight to the row, which would drift the name a user
 * signs in with away from `users.handle` and around the case-insensitive
 * uniqueness that `users_handle_lower_unique` holds. Virtool owns account
 * updates through its own server functions.
 */
const REFUSED_PATHS = new Set([
	"/sign-in/email",
	"/is-username-available",
	"/update-user",
	"/list-sessions",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
]);

/** What {@link createAuth} needs to build an instance. */
export type AuthOptions = {
	db: Db;
	publicOrigin: string;
	webauthnRpId: string;
	secret: string;
};

function virtoolSessionPlugin(db: Db) {
	return {
		id: "virtool-session",
		endpoints: {
			createRemediationSession: createAuthEndpoint.serverOnly(
				{
					method: "POST",
					body: z.object({ userId: z.number().int().positive() }),
				},
				async (ctx) => {
					const user = await ctx.context.internalAdapter.findUserById(
						String(ctx.body.userId),
					);
					if (!user) {
						throw new APIError("UNAUTHORIZED");
					}

					const session = await ctx.context.internalAdapter.createSession(
						user.id,
					);
					await setSessionCookie(ctx, { session, user });

					return ctx.json({ user });
				},
			),
			createStepUpSession: createAuthEndpoint.serverOnly(
				{
					method: "POST",
					use: [sensitiveSessionMiddleware],
				},
				async (ctx) => {
					const current = ctx.context.session;
					const sessionId = Number(current.session.id);
					const userId = Number(current.user.id);
					if (
						!Number.isSafeInteger(sessionId) ||
						!Number.isSafeInteger(userId)
					) {
						throw new APIError("UNAUTHORIZED");
					}
					const dontRememberMe = Boolean(
						await ctx.getSignedCookie(
							ctx.context.authCookies.dontRememberToken.name,
							ctx.context.secret,
						),
					);

					const replacement = await ctx.context.internalAdapter.createSession(
						current.user.id,
						dontRememberMe,
						{
							ipAddress: current.session.ipAddress,
							userAgent: current.session.userAgent,
							browser: current.session.browser,
							operatingSystem: current.session.operatingSystem,
							replacementForSessionId: sessionId,
						},
						true,
					);
					const deleted = await db
						.delete(authSessions)
						.where(
							and(
								eq(authSessions.id, sessionId),
								eq(authSessions.userId, userId),
								eq(authSessions.token, current.session.token),
							),
						)
						.returning({ id: authSessions.id });

					if (deleted.length !== 1) {
						await ctx.context.internalAdapter.deleteSession(replacement.token);
						throw new APIError("UNAUTHORIZED", {
							code: "STEP_UP_SESSION_ENDED",
							message: "Session ended during authentication",
						});
					}

					try {
						await setSessionCookie(ctx, {
							session: replacement,
							user: current.user,
						});
					} catch (err) {
						await ctx.context.internalAdapter.deleteSession(replacement.token);
						throw err;
					}

					return ctx.json({
						createdAt: replacement.createdAt,
						sessionId: replacement.id,
					});
				},
			),
		},
	} satisfies BetterAuthPlugin;
}

/**
 * Build the Better Auth instance.
 *
 * Better Auth handles authentication only. Virtool keeps account state,
 * authorization, API keys and first-user detection; `./policy` remains the
 * only authority for what a caller may do.
 *
 * Keep Better Auth and its passkey plugin pinned together on 1.6 until the
 * integer identity integration is migrated for 1.7's account model.
 * `@simplewebauthn/server` is a direct dependency so the passkey plugin's inferred
 * types are nameable across the server/browser TypeScript project boundary.
 *
 * Takes its dependencies as arguments so tests can build an instance against a
 * throwaway database.
 */
export function createAuth({
	db,
	publicOrigin,
	webauthnRpId,
	secret,
}: AuthOptions) {
	const auth = betterAuth({
		appName: "Virtool",
		baseURL: publicOrigin,
		basePath: AUTH_BASE_PATH,
		secret,
		rateLimit: { enabled: true, storage: "database" },
		// The one origin this instance answers on. Better Auth otherwise trusts
		// whatever `Host` says, and every callback and WebAuthn ceremony would
		// then validate against an attacker-supplied value.
		trustedOrigins: [publicOrigin],
		database: drizzleAdapter(db, {
			provider: "pg",
			// Named explicitly rather than left to `db._.fullSchema`. Better Auth
			// addresses models by singular name (`user`, `session`) while the schema
			// exports them plural, so explicit mapping keeps model ownership clear.
			schema: {
				user: users,
				account: authAccounts,
				session: authSessions,
				verification: authVerifications,
				twoFactor: authTwoFactors,
				passkey: authPasskeys,
				rateLimit: authRateLimits,
			},
		}),
		session: {
			cookieCache: { enabled: false },
			freshAge: SESSION_FRESH_AGE_SECONDS,
			additionalFields: {
				browser: { type: "string", input: false },
				operatingSystem: { type: "string", input: false },
				replacementForSessionId: {
					type: "number",
					input: false,
					returned: false,
				},
			},
		},
		advanced: {
			ipAddress: {
				ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
			},
			// Stated rather than left to default. Better Auth turns its origin check
			// off whenever `NODE_ENV` is `test`, so without this the suite would
			// exercise a configuration production never runs and prove nothing about
			// the one it does.
			disableOriginCheck: false,
			database: {
				// The reason `users.id` survives as the integer every domain foreign
				// key and wire contract already references. `"serial"` makes Better
				// Auth omit `id` on insert, leaving it to the identity column, and
				// type it as a number rather than the string it mints by default.
				//
				// The setting is instance-wide in 1.6 — there is no per-model
				// switch — so the auxiliary tables are keyed the same way. That is
				// why `packages/data/src/db/schema/auth.ts` gives each of them an
				// identity primary key instead of a uuid.
				generateId: "serial",
			},
		},
		emailAndPassword: {
			enabled: true,
			// Virtool has no public sign-up: an administrator creates a pending
			// account, or the first-run bootstrap creates the first one. Both stay
			// Virtool workflows.
			disableSignUp: true,
			// The `$2b$12$` hashes already in `users.password` have to keep
			// verifying, so bcrypt at the same cost is the algorithm on both sides
			// rather than Better Auth's default scrypt. `@virtool/data/auth/password`
			// is the one place the cost is stated.
			password: {
				hash: async (password) =>
					(await hashPassword(password)).toString("utf8"),
				verify: async ({ hash, password }) =>
					verifyPassword(password, Buffer.from(hash, "utf8")),
			},
		},
		hooks: {
			// `NOT_FOUND` because a refused endpoint is not part of this instance's
			// surface at all. See REFUSED_PATHS for what each one would otherwise
			// expose.
			before: createAuthMiddleware(async (ctx) => {
				if (REFUSED_PATHS.has(ctx.path)) {
					throw new APIError("NOT_FOUND");
				}
			}),
		},
		databaseHooks: {
			session: {
				create: {
					// Better Auth answers *who*, so the Virtool states that gate a
					// sign-in are enforced at the one point every password, passkey and
					// two-factor path has to pass through.
					//
					// A deactivated user gets the same 401 the wrong password gets: that
					// an account exists but is switched off is not something an
					// unauthenticated caller should be able to read off the response. An
					// account that has not completed setup gets it too, and for the same
					// reason — an outstanding invitation is not public information.
					//
					// This is also what keeps a setup flow from short-circuiting itself.
					// A completion transaction moves the account out of `pending` before
					// its caller mints any session, so an ordinary session can only ever
					// be issued to an account that is already eligible for one.
					before: async (session) => {
						const [user] = await db
							.select({
								active: users.active,
								lifecycleState: users.lifecycleState,
							})
							.from(users)
							.where(eq(users.id, Number(session.userId)))
							.limit(1);

						if (!user?.active || user.lifecycleState !== "normal") {
							throw new APIError("UNAUTHORIZED", {
								message: "Invalid credentials",
								code: "INVALID_CREDENTIALS",
							});
						}

						return {
							data: {
								...session,
								...normalizeBrowserSessionMetadata(undefined, session),
							},
						};
					},
				},
			},
		},
		plugins: [
			virtoolSessionPlugin(db),
			recentAuthenticationPlugin(
				async function verify(headers, challenge): Promise<void> {
					if (challenge.method === "password") {
						await auth.api.verifyPassword({
							headers,
							body: { password: challenge.password },
						});
					} else {
						await auth.api.verifyTOTP({
							headers,
							body: { code: challenge.code, trustDevice: false },
						});
					}
				},
			),
			// A Virtool handle is case-insensitive and keeps its original case for
			// display, which is exactly the split this plugin draws between the
			// normalized `username` it matches on and the `displayUsername` it
			// shows.
			//
			// The rule is stated once in `./handle` and enforced again where a
			// handle is set. The plugin checks it before the user lookup, so a
			// handle it rejects is one that could exist but never sign in.
			username({
				usernameValidator: isValidHandle,
				minUsernameLength: HANDLE_MIN_LENGTH,
				maxUsernameLength: HANDLE_MAX_LENGTH,
			}),
			twoFactor({
				issuer: "Virtool",
				// Recovery codes are not optional in this plugin — enrolling in TOTP
				// always mints a set — so the only choice here is how they are held.
				// Encrypted, because a code is a second factor in plaintext and the
				// row sits beside the TOTP secret it would otherwise stand in for.
				backupCodeOptions: { storeBackupCodes: "encrypted" },
			}),
			passkey({
				rpID: webauthnRpId,
				rpName: "Virtool",
				origin: publicOrigin,
				// The authenticator must prove a person was present *and* verified —
				// a PIN, a fingerprint, a face. Without it a passkey degrades to
				// possession of an unlocked device.
				authenticatorSelection: { userVerification: "required" },
			}),
			// Must stay last: it copies whatever `set-cookie` the endpoints above
			// produced onto the TanStack Start response, so a plugin registered
			// after it would set cookies this never sees.
			tanstackStartCookies(),
		],
	});
	return auth;
}

const FORCED_RESET_ALLOWED_PATHS = new Set([
	`${AUTH_BASE_PATH}/get-session`,
	`${AUTH_BASE_PATH}/sign-out`,
]);

/** Wrap Better Auth's raw handler with Virtool's forced-reset restriction. */
export function createAuthRequestHandler(
	db: Db,
	auth: ReturnType<typeof createAuth>,
): (request: Request) => Promise<Response> {
	return async function handleAuthRequest(request: Request): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (!FORCED_RESET_ALLOWED_PATHS.has(pathname)) {
			const session = await auth.api.getSession({
				headers: request.headers,
				query: { disableCookieCache: true, disableRefresh: true },
			});

			if (session) {
				const userId = Number(session.user.id);
				const [user] = Number.isSafeInteger(userId)
					? await db
							.select({ forceReset: users.forceReset })
							.from(users)
							.where(eq(users.id, userId))
							.limit(1)
					: [];

				if (!user || user.forceReset) {
					return Response.json(
						{
							code: "PASSWORD_RESET_REQUIRED",
							message: "Password reset required",
						},
						{ status: 403 },
					);
				}
			}
		}

		return auth.handler(request);
	};
}
