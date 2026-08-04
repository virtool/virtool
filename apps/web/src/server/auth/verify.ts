import { timingSafeEqual } from "node:crypto";

import { emptyPermissions, type Permissions } from "@virtool/contracts";
import { hashToken } from "@virtool/data/auth/tokens";

import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import { and, eq, sql } from "drizzle-orm";
import { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } from "./cookies";

/** Authenticated identity resolved from a session cookie pair or an API key. */
export type AuthenticatedSession = {
	userId: number;
	/**
	 * Set only when the caller authenticated with an API key. The key's
	 * permissions cap the user's own, so `hasPermission` must intersect the two.
	 */
	keyPermissions?: Permissions;
};

/**
 * Resolve an authenticated session from cookie values. Returns `null` for any
 * non-fatal failure (missing cookies, unknown session, wrong type, expired,
 * deactivated user, or token mismatch) so callers can respond with a single 401
 * without leaking which check failed.
 */
export async function verifyAuthenticatedSession(
	db: Db,
	sessionId: string | undefined,
	sessionToken: string | undefined,
): Promise<AuthenticatedSession | null> {
	if (!sessionId || !sessionToken) {
		return null;
	}

	// A TS-side deactivation deletes the user's sessions, but Python's does not,
	// so `active` still has to be checked on every request rather than trusted at
	// login — a session Python left behind must stop verifying the moment the user
	// goes inactive. The inner join only drops anonymous sessions, which carry no
	// user_id and are rejected anyway.
	const [row] = await db
		.select({
			userId: sessions.userId,
			sessionType: sessions.sessionType,
			tokenHash: sessions.tokenHash,
			expiresAt: sessions.expiresAt,
			active: users.active,
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.sessionId, sessionId))
		.limit(1);

	if (
		row?.sessionType !== "authenticated" ||
		!row.tokenHash ||
		row.userId === null ||
		!row.active
	) {
		return null;
	}

	if (row.expiresAt.getTime() <= Date.now()) {
		return null;
	}

	const expected = Buffer.from(row.tokenHash, "utf8");
	const provided = Buffer.from(hashToken(sessionToken), "utf8");
	if (
		expected.length !== provided.length ||
		!timingSafeEqual(expected, provided)
	) {
		return null;
	}

	return { userId: row.userId };
}

/**
 * Parse a `Cookie` header into a flat map. Lightweight; sufficient for reading
 * our two session cookies from a raw `Request` (where the `getCookie` helper
 * tied to async-local request context isn't available).
 */
export function parseCookieHeader(
	header: string | null,
): Record<string, string> {
	if (!header) {
		return {};
	}
	const out: Record<string, string> = {};
	for (const part of header.split(";")) {
		const idx = part.indexOf("=");
		if (idx < 0) {
			continue;
		}
		const key = part.slice(0, idx).trim();
		if (!key) {
			continue;
		}
		const value = part.slice(idx + 1).trim();
		out[key] = decodeURIComponent(value);
	}
	return out;
}

/** The login and password carried by an HTTP Basic `Authorization` header. */
export type BasicCredentials = {
	handle: string;
	key: string;
};

/**
 * Parse an HTTP Basic `Authorization` header into its login and password.
 * Returns `null` for anything malformed — a non-Basic scheme, undecodable
 * base64, a missing separator, or an empty login — which callers treat as a
 * failed authentication rather than falling back to cookies.
 */
export function parseBasicAuthHeader(header: string): BasicCredentials | null {
	// RFC 7235 allows one *or more* spaces between the scheme and the
	// credentials, so split on runs of whitespace rather than a single space.
	// Requiring exactly two parts still rejects a header with trailing junk —
	// base64 contains no whitespace, so a third part means the header is broken.
	const parts = header.trim().split(/\s+/);

	if (parts.length !== 2) {
		return null;
	}

	const [scheme, encoded] = parts;

	if (scheme?.toLowerCase() !== "basic" || !encoded) {
		return null;
	}

	const decoded = Buffer.from(encoded, "base64").toString("utf8");
	const idx = decoded.indexOf(":");

	if (idx < 1) {
		return null;
	}

	return { handle: decoded.slice(0, idx), key: decoded.slice(idx + 1) };
}

/**
 * Resolve an identity from a user handle and a raw API key. Returns `null` for
 * any failure — unknown handle, deactivated user, or a key that is not that
 * user's — so callers answer a single 401 without saying which check failed.
 *
 * Handles are matched case-insensitively, as they are at login and in Python's
 * `get_by_handle`. Only the key's SHA-256 is stored, so the lookup hashes the
 * supplied secret and matches on that; the digest is indexed and unique, and
 * scoping it to the user keeps one account's key from authenticating another's
 * handle.
 */
export async function verifyApiKey(
	db: Db,
	handle: string,
	key: string,
): Promise<AuthenticatedSession | null> {
	// The lookup below matches the handle case-insensitively, so the prefix check
	// has to as well — otherwise `JOB-1` would slip past a guard that `job-1`
	// trips and then resolve to the very same row.
	const normalized = handle.toLowerCase();

	// Job keys use this same header format against the separate jobs API. Python
	// refuses them here rather than resolving `job-{id}` as a user handle, and a
	// handle that reaches Postgres either way must not authenticate differently
	// depending on which backend served it.
	if (!normalized || normalized.startsWith("job")) {
		return null;
	}

	const [row] = await db
		.select({
			userId: users.id,
			active: users.active,
			permissions: apiKeys.permissions,
		})
		.from(users)
		.innerJoin(apiKeys, eq(apiKeys.userId, users.id))
		.where(
			and(
				sql`lower(${users.handle}) = ${normalized}`,
				eq(apiKeys.hashed, hashToken(key)),
			),
		)
		.limit(1);

	if (!row?.active) {
		return null;
	}

	// Keys written by the legacy Python path stored only the permissions that
	// were granted, so expand against the full set before it becomes a cap.
	return {
		userId: row.userId,
		keyPermissions: { ...emptyPermissions(), ...row.permissions },
	};
}

/** Resolve an authenticated session directly from a `Request`. */
export async function verifyRequest(
	db: Db,
	request: Request,
): Promise<AuthenticatedSession | null> {
	const cookies = parseCookieHeader(request.headers.get("cookie"));
	return verifyAuthenticatedSession(
		db,
		cookies[SESSION_ID_COOKIE],
		cookies[SESSION_TOKEN_COOKIE],
	);
}
