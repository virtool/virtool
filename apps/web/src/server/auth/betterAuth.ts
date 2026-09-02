import { passkey } from "@better-auth/passkey";
import { createServerOnlyFn } from "@tanstack/react-start";
import { hashPassword, verifyPassword } from "@virtool/data/auth/password";
import type { Db } from "@virtool/data/db/pg";
import {
	authAccounts,
	authPasskeys,
	authSessions,
	authTwoFactors,
	authVerifications,
} from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "../composition";
import { config } from "../config";

/** Where the Better Auth handler is mounted. */
export const AUTH_BASE_PATH = "/api/auth";

/** What {@link createAuth} needs to build an instance. */
export type AuthOptions = {
	db: Db;
	publicOrigin: string;
	webauthnRpId: string;
	secret: string;
};

/**
 * Build the Better Auth instance.
 *
 * Better Auth answers *who is signing in*, and nothing else. Virtool keeps
 * `users.active`, administrator roles, groups, permissions, instance settings,
 * API keys and first-user detection, and `./policy` remains the only thing that
 * decides what a caller may do. Better Auth's own admin, ban and role features
 * are deliberately not registered — a second authorization system that
 * disagreed with the first would be worse than either alone.
 *
 * Takes its dependencies as arguments so tests can build an instance against a
 * throwaway database. The process-wide one is {@link auth}.
 */
export function createAuth({
	db,
	publicOrigin,
	webauthnRpId,
	secret,
}: AuthOptions) {
	return betterAuth({
		appName: "Virtool",
		baseURL: publicOrigin,
		basePath: AUTH_BASE_PATH,
		secret,
		// The one origin this instance answers on. Better Auth otherwise trusts
		// whatever `Host` says, and every callback and WebAuthn ceremony would
		// then validate against an attacker-supplied value.
		trustedOrigins: [publicOrigin],
		database: drizzleAdapter(db, {
			provider: "pg",
			// Named explicitly rather than left to `db._.fullSchema`. Better Auth
			// addresses models by singular name (`user`, `session`), the schema
			// exports them plural, and the legacy `sessions` table would otherwise
			// be a candidate for the `session` model it must never touch.
			schema: {
				user: users,
				account: authAccounts,
				session: authSessions,
				verification: authVerifications,
				twoFactor: authTwoFactors,
				passkey: authPasskeys,
			},
		}),
		advanced: {
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
		plugins: [
			// A Virtool handle is case-insensitive and keeps its original case for
			// display, which is exactly the split this plugin draws between the
			// normalized `username` it matches on and the `displayUsername` it
			// shows.
			username(),
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
}

/** The Better Auth instance for this process. */
export const auth = createAuth({
	db,
	publicOrigin: config.publicOrigin,
	webauthnRpId: config.webauthnRpId,
	secret: config.authSecret,
});

/**
 * Hand a request to Better Auth.
 *
 * Wrapped in `createServerOnlyFn` so the route module that mounts it can import
 * this without pulling Better Auth, `@virtool/data` and `node:crypto` into the
 * browser graph through the route tree.
 */
export const handleAuthRequest = createServerOnlyFn(
	(request: Request): Promise<Response> => auth.handler(request),
);
