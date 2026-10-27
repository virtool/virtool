import { passkey } from "@better-auth/passkey";
import {
	AUTH_BASE_PATH,
	RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH,
} from "@virtool/contracts";
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
	sensitiveSessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { twoFactor, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { SESSION_FRESH_AGE_SECONDS } from "./freshness";
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, isValidHandle } from "./handle";
import { getNewPasskeyName, passkeyNamePlugin } from "./passkeyName";
import { assertDatabaseReachable } from "./probe";
import { createRateLimitStorage } from "./rateLimitStorage";
import {
	RECENT_AUTHENTICATION_PATH,
	recentAuthenticationPlugin,
} from "./recentAuthenticationChallenge";
import {
	AUTH_IP_ADDRESS_OPTIONS,
	normalizeBrowserSessionMetadata,
} from "./sessionMetadata";
import { trustDeviceGuardPlugin } from "./trustDevice";

/**
 * The Better Auth endpoints the browser and Virtool's own server code call over
 * HTTP, as `METHOD path`. Every other endpoint, including any that a plugin or
 * an upgrade adds, answers 404.
 *
 * Password and second-factor sign-in, sign-out, sessions, passwords, and the
 * passkey list and its mutations, and TOTP removal and recovery-code
 * replacement go through `auth.api` in Virtool's server functions, which apply
 * Virtool's policy. `/two-factor/get-totp-uri` stays out because it returns the
 * TOTP secret again for only the password. `/two-factor/enable` checks only the
 * password, so it stays because Better Auth refuses it once TOTP is on.
 *
 * The match is exact, so a variant of a path, such as one with a trailing
 * slash or in a different case, is refused.
 */
const HTTP_ALLOWED_ENDPOINTS = new Set(
	[
		["GET", "/passkey/generate-authenticate-options"],
		["POST", "/passkey/verify-authentication"],
		["GET", "/passkey/generate-register-options"],
		["POST", "/passkey/verify-registration"],
		["POST", "/two-factor/enable"],
		["POST", "/two-factor/verify-totp"],
		["GET", RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH],
		["POST", RECENT_AUTHENTICATION_PATH],
	].map(([method, path]) => `${method} ${AUTH_BASE_PATH}${path}`),
);

/**
 * Limit passkey sign-in as Better Auth limits its own sign-in paths.
 *
 * Better Auth's default rule matches only paths that start with `/sign-in`.
 */
const PASSKEY_SIGN_IN_RATE_LIMIT = { window: 10, max: 3 };

/**
 * Limit passkey challenges separately from sign-in attempts.
 *
 * The sign-in form asks for a new challenge each time its autofill request
 * starts again, so the sign-in limit would refuse a user who cancels a passkey
 * dialog twice. An options request writes a challenge row, so the limit also
 * stops a caller who fills the verification table.
 */
const PASSKEY_OPTIONS_RATE_LIMIT = { window: 60, max: 10 };

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
					const replacement = await ctx.context.internalAdapter.createSession(
						current.user.id,
						false,
						{ replacementForSessionId: sessionId },
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

function rejectUnverifiedUser(): never {
	throw new APIError("BAD_REQUEST", {
		code: "USER_VERIFICATION_REQUIRED",
		message: "The authenticator did not verify the user",
	});
}

function rejectRegisteredPasskey(): never {
	throw new APIError("BAD_REQUEST", {
		code: "PASSKEY_ALREADY_REGISTERED",
		message: "Passkey already registered",
	});
}

/**
 * Build the Better Auth instance.
 *
 * Better Auth handles authentication only. Virtool keeps account state,
 * authorization, API keys and first-user detection; `./policy` remains the
 * only authority for what a caller may do.
 *
 * `@simplewebauthn/server` is a direct dependency so the passkey plugin's inferred
 * types are nameable across the server/browser TypeScript project boundary. A
 * pnpm override keeps the plugin on the same version, so there is one copy.
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
			// Keys are paths without the base path.
			customRules: {
				"/passkey/generate-authenticate-options": PASSKEY_OPTIONS_RATE_LIMIT,
				"/passkey/verify-authentication": PASSKEY_SIGN_IN_RATE_LIMIT,
			},
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
				// The setting is instance-wide — there is no per-model
				// switch — so the auxiliary tables are keyed the same way. That is
				// why `packages/data/src/db/schema/auth.ts` gives each of them an
				// identity primary key instead of a uuid.
				generateId: "serial",
				// The check requires every column Better Auth does not write to be
				// nullable or defaulted, so that its inserts succeed. Better Auth
				// never inserts into `users` here (sign-up is off), and `handle`,
				// `lastPasswordChange` and `settings` are NOT NULL Virtool columns.
				validateSchema: false,
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
			trustDeviceGuardPlugin(),
			recentAuthenticationPlugin({
				db,
				origin: publicOrigin,
				rpID: webauthnRpId,
				async verify(headers, challenge): Promise<void> {
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
			}),
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
			passkeyNamePlugin(db),
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
					async afterVerification({ ctx, verification }) {
						const info = verification.registrationInfo;
						if (!info?.userVerified) {
							rejectUnverifiedUser();
						}
						if (await isPasskeyCredentialRegistered(db, info.credential.id)) {
							rejectRegisteredPasskey();
						}
						return {
							name: getNewPasskeyName(
								info.aaguid,
								ctx.headers?.get("user-agent") ?? null,
							),
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

// Enrollment is Better Auth's own `enable` then `verify-totp`. The first
// successful verification sets `twoFactorEnabled`, which lifts the
// restriction on the next request.
const MFA_ENROLLMENT_ALLOWED_PATHS = new Set([
	`${AUTH_BASE_PATH}/two-factor/enable`,
	`${AUTH_BASE_PATH}/two-factor/verify-totp`,
]);

/**
 * Wrap Better Auth's raw handler with Virtool's endpoint allow-list and its
 * forced-reset and required-MFA restrictions.
 *
 * Better Auth answers a failed query with a bare 500, so a server error is
 * checked against the database to let an outage reach the client as a 503.
 */
export function createAuthRequestHandler(
	db: Db,
	auth: ReturnType<typeof createAuth>,
): (request: Request) => Promise<Response> {
	return async function handleAuthRequest(request: Request): Promise<Response> {
		let response: Response;
		try {
			response = await routeAuthRequest(request);
		} catch (err) {
			await assertDatabaseReachable(db);
			throw err;
		}
		if (response.status >= 500) {
			await assertDatabaseReachable(db);
		}
		return response;
	};

	async function routeAuthRequest(request: Request): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (!HTTP_ALLOWED_ENDPOINTS.has(`${request.method} ${pathname}`)) {
			return new Response(null, { status: 404 });
		}

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

		return auth.handler(request);
	}
}
