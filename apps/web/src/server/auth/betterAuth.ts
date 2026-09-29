import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { DEFAULT_PASSKEY_NAME } from "@virtool/contracts";
import { isPasskeyCredentialRegistered } from "@virtool/data/auth/passkeys";
import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import { mfaEnrollmentRequired } from "@virtool/data/auth/session";
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
import { createRateLimitStorage } from "./rateLimitStorage";
import { recentAuthenticationPlugin } from "./recentAuthenticationChallenge";
import {
	AUTH_IP_ADDRESS_OPTIONS,
	normalizeBrowserSessionMetadata,
} from "./sessionMetadata";

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
 *
 * The passkey list, rename and delete endpoints: the list returns public keys
 * and counters, and neither mutation checks recent authentication or the
 * password fallback. Virtool's account server functions serve all three.
 */
const REFUSED_PATHS = new Set([
	"/sign-in/email",
	"/is-username-available",
	"/update-user",
	"/list-sessions",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
	"/passkey/list-user-passkeys",
	"/passkey/update-passkey",
	"/passkey/delete-passkey",
]);

/** The passkey endpoint that starts a sign-in. */
export const PASSKEY_SIGN_IN_OPTIONS_PATH =
	"/passkey/generate-authenticate-options";

/** The passkey endpoint that signs a user in. */
export const PASSKEY_SIGN_IN_PATH = "/passkey/verify-authentication";

/**
 * Better Auth endpoints reachable only through server functions.
 *
 * `./passkeyActions` calls the passkey ceremonies from server functions so it
 * can apply Virtool's recent-authentication policy, override the options the
 * plugin sends, and shape the result. Over HTTP they would skip all three.
 */
const SERVER_FUNCTION_PATHS = new Set(
	[
		"/passkey/generate-register-options",
		"/passkey/verify-registration",
		PASSKEY_SIGN_IN_OPTIONS_PATH,
		PASSKEY_SIGN_IN_PATH,
	].map((path) => `${AUTH_BASE_PATH}${path}`),
);

/**
 * Limit passkey sign-in as Better Auth limits its own sign-in paths.
 *
 * Better Auth's default rule matches only paths that start with `/sign-in`.
 * An options request writes a challenge row, so the limit also stops a caller
 * who fills the verification table.
 */
function passkeySignInRateLimitPlugin() {
	return {
		id: "virtool-passkey-sign-in-rate-limit",
		rateLimit: [
			{
				pathMatcher(path) {
					return (
						path === PASSKEY_SIGN_IN_OPTIONS_PATH ||
						path === PASSKEY_SIGN_IN_PATH
					);
				},
				window: 10,
				max: 3,
			},
		],
	} satisfies BetterAuthPlugin;
}

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
 * Apply the two-factor plugin's sign-in gate to passkey sign-in too.
 *
 * The plugin matches only its password sign-in paths, so a passkey would
 * otherwise issue a full session to a user enrolled in TOTP. Reusing its own
 * handler means both paths set the same pending challenge cookie and answer
 * with the same `twoFactorRedirect`.
 */
function withPasskeyTwoFactor<T extends ReturnType<typeof twoFactor>>(
	plugin: T,
): T {
	const [signIn] = plugin.hooks.after;
	if (!signIn) {
		throw new Error("Better Auth two-factor plugin has no sign-in hook");
	}

	return {
		...plugin,
		hooks: {
			...plugin.hooks,
			after: [
				...plugin.hooks.after,
				{
					matcher: (context: { path?: string }) =>
						context.path === PASSKEY_SIGN_IN_PATH,
					handler: signIn.handler,
				},
			],
		},
	};
}

function rejectUnverifiedUser(): never {
	throw new APIError("BAD_REQUEST", {
		code: "USER_VERIFICATION_REQUIRED",
		message: "The authenticator did not verify the user",
	});
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
		rateLimit: {
			enabled: true,
			customStorage: createRateLimitStorage(db),
		},
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
				replacementForSessionId: {
					type: "number",
					input: false,
					returned: false,
				},
			},
		},
		advanced: {
			ipAddress: AUTH_IP_ADDRESS_OPTIONS,
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
			passkeySignInRateLimitPlugin(),
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
			withPasskeyTwoFactor(
				twoFactor({
					issuer: "Virtool",
					// Recovery codes are not optional in this plugin — enrolling in TOTP
					// always mints a set — so the only choice here is how they are held.
					// Encrypted, because a code is a second factor in plaintext and the
					// row sits beside the TOTP secret it would otherwise stand in for.
					backupCodeOptions: { storeBackupCodes: "encrypted" },
				}),
			),
			passkey({
				rpID: webauthnRpId,
				rpName: "Virtool",
				origin: publicOrigin,
				authenticatorSelection: {
					// Discoverable, so a user can sign in without typing a handle first.
					residentKey: "required",
					// The authenticator must prove a person was present *and* verified —
					// a PIN, a fingerprint, a face. Without it a passkey degrades to
					// possession of an unlocked device.
					userVerification: "required",
				},
				// The plugin verifies both ceremonies with `requireUserVerification:
				// false` whatever the options above ask the browser for, so the flag
				// is checked again here, after the signature has been verified.
				registration: {
					async afterVerification({ verification }) {
						const info = verification.registrationInfo;
						if (!info?.userVerified) {
							rejectUnverifiedUser();
						}
						if (await isPasskeyCredentialRegistered(db, info.credential.id)) {
							throw new APIError("BAD_REQUEST", {
								code: "PASSKEY_ALREADY_REGISTERED",
								message: "Passkey already registered",
							});
						}
						return {
							name: getAuthenticatorName(info.aaguid) ?? DEFAULT_PASSKEY_NAME,
						};
					},
				},
				authentication: {
					afterVerification({ verification }) {
						if (!verification.authenticationInfo.userVerified) {
							rejectUnverifiedUser();
						}
					},
				},
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

// Enrollment is Better Auth's own `enable` then `verify-totp`. The first
// successful verification sets `twoFactorEnabled`, which lifts the
// restriction on the next request.
const MFA_ENROLLMENT_ALLOWED_PATHS = new Set([
	`${AUTH_BASE_PATH}/get-session`,
	`${AUTH_BASE_PATH}/sign-out`,
	`${AUTH_BASE_PATH}/two-factor/enable`,
	`${AUTH_BASE_PATH}/two-factor/verify-totp`,
]);

/**
 * Wrap Better Auth's raw handler with Virtool's forced-reset and required-MFA
 * restrictions.
 */
export function createAuthRequestHandler(
	db: Db,
	auth: ReturnType<typeof createAuth>,
): (request: Request) => Promise<Response> {
	return async function handleAuthRequest(request: Request): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (SERVER_FUNCTION_PATHS.has(pathname)) {
			return new Response(null, { status: 404 });
		}
		if (!FORCED_RESET_ALLOWED_PATHS.has(pathname)) {
			const session = await auth.api.getSession({
				headers: request.headers,
				query: { disableCookieCache: true, disableRefresh: true },
			});

			if (session) {
				const userId = Number(session.user.id);
				const [user] = Number.isSafeInteger(userId)
					? await db
							.select({
								forceReset: users.forceReset,
								mfaEnrollmentRequired,
							})
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

				if (
					user.mfaEnrollmentRequired &&
					!MFA_ENROLLMENT_ALLOWED_PATHS.has(pathname)
				) {
					return Response.json(
						{
							code: "MFA_ENROLLMENT_REQUIRED",
							message: "TOTP enrollment required",
						},
						{ status: 403 },
					);
				}
			}
		}

		return auth.handler(request);
	};
}
