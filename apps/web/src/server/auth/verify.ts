import { timingSafeEqual } from "node:crypto";

import {
	type ApiKeyPrincipal,
	type BrowserSessionPrincipal,
	emptyPermissions,
} from "@virtool/contracts";
import { resolveBrowserSession } from "@virtool/data/auth/session";
import { hashToken } from "@virtool/data/auth/tokens";

import type { Db } from "@virtool/data/db/pg";
import { apiKeys } from "@virtool/data/db/schema/apiKeys";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import { and, eq, sql } from "drizzle-orm";
import { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } from "./cookies";

async function getBetterAuthSession(headers: Headers) {
	const { auth } = await import("./instance");
	return auth.api.getSession({
		headers,
		query: { disableCookieCache: true, disableRefresh: true },
	});
}

type BetterAuthSession = {
	session: { id: unknown };
	user: { id: unknown };
};

/**
 * Resolve an authoritative Better Auth browser session and its Virtool state.
 * Missing, invalid, expired, revoked, inactive, and unmapped credentials all
 * return `null`; provider failures throw so callers do not mistake an outage
 * for revocation.
 */
export async function verifyBrowserPrincipal(
	db: Db,
	request: Request,
	resolveSession: (
		headers: Headers,
	) => Promise<BetterAuthSession | null> = getBetterAuthSession,
): Promise<BrowserSessionPrincipal | null> {
	const resolved = await resolveSession(request.headers);
	if (!resolved) {
		return null;
	}

	const userId = Number(resolved.user.id);
	const sessionId = Number(resolved.session.id);
	if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(sessionId)) {
		return null;
	}

	const row = await resolveBrowserSession(db, sessionId, userId);
	if (!row) {
		return null;
	}

	return {
		kind: row.forceReset ? "password_reset" : "browser",
		userId,
		sessionId,
		sessionStore: "better_auth",
		timing: {
			lastActivityAt: row.lastActivityAt,
			expiresAt: row.expiresAt,
			absoluteExpiresAt: row.absoluteExpiresAt,
		},
	};
}

/** Resolve a retained legacy browser or forced-reset session. */
export async function verifyLegacyBrowserPrincipal(
	db: Db,
	request: Request,
): Promise<BrowserSessionPrincipal | null> {
	const cookies = parseCookieHeader(request.headers.get("cookie"));
	const sessionId = cookies[SESSION_ID_COOKIE];
	if (!sessionId) {
		return null;
	}

	const [row] = await db
		.select({
			id: sessions.id,
			userId: sessions.userId,
			createdAt: sessions.createdAt,
			sessionType: sessions.sessionType,
			tokenHash: sessions.tokenHash,
			expiresAt: sessions.expiresAt,
			active: users.active,
			lifecycleState: users.lifecycleState,
			forceReset: users.forceReset,
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(
			and(
				eq(sessions.sessionId, sessionId),
				sql`${sessions.expiresAt} > timezone('utc', clock_timestamp())`,
			),
		)
		.limit(1);

	if (!row?.active || row.userId === null || row.lifecycleState !== "normal") {
		return null;
	}

	const token = cookies[SESSION_TOKEN_COOKIE];
	if (
		(row.sessionType !== "authenticated" && row.sessionType !== "reset") ||
		!row.tokenHash ||
		!token
	) {
		return null;
	}

	const expected = Buffer.from(row.tokenHash, "utf8");
	const provided = Buffer.from(hashToken(token), "utf8");
	if (
		expected.length !== provided.length ||
		!timingSafeEqual(expected, provided)
	) {
		return null;
	}

	if (row.sessionType === "reset") {
		return row.forceReset
			? {
					kind: "password_reset",
					sessionId: row.id,
					sessionStore: "legacy",
					userId: row.userId,
					timing: {
						lastActivityAt: row.createdAt,
						expiresAt: row.expiresAt,
						absoluteExpiresAt: row.expiresAt,
					},
				}
			: null;
	}

	return {
		kind: "browser",
		sessionId: row.id,
		sessionStore: "legacy",
		userId: row.userId,
		timing: {
			lastActivityAt: row.createdAt,
			expiresAt: row.expiresAt,
			absoluteExpiresAt: row.expiresAt,
		},
	};
}

/**
 * Parse a `Cookie` header into a flat map. Lightweight; sufficient for reading
 * session cookies from a raw `Request` (where the `getCookie` helper
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
 * any failure — unknown handle, deactivated user, an account that has not
 * completed setup, or a key that is not that user's — so callers answer a
 * single 401 without saying which check failed.
 *
 * Handles are matched case-insensitively, as they are at login. Only the key's
 * SHA-256 is stored, so the lookup hashes the supplied secret and matches on
 * that; the digest is indexed and unique, and scoping it to the user keeps one
 * account's key from authenticating another's handle.
 */
export async function verifyApiKey(
	db: Db,
	handle: string,
	key: string,
): Promise<ApiKeyPrincipal | null> {
	// The lookup below matches the handle case-insensitively, so the prefix check
	// has to as well — otherwise `JOB-1` would slip past a guard that `job-1`
	// trips and then resolve to the very same row.
	const normalized = handle.toLowerCase();

	// Job keys use this same header format against the separate jobs API. They
	// are refused here rather than resolved as a `job-{id}` user handle, so a job
	// key can never authenticate against this API.
	if (!normalized || normalized.startsWith("job")) {
		return null;
	}

	const [row] = await db
		.select({
			keyId: apiKeys.id,
			userId: users.id,
			active: users.active,
			lifecycleState: users.lifecycleState,
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

	// A pending account has no keys to find, so this is a floor rather than a
	// live case: a restricted setup credential must never turn into a machine
	// one, and the rule belongs where it can be read off the code.
	if (!row?.active || row.lifecycleState !== "normal") {
		return null;
	}

	// Keys written by an older release stored only the permissions that were
	// granted, so expand against the full set before it becomes a cap.
	return {
		kind: "api_key",
		keyId: row.keyId,
		userId: row.userId,
		permissions: { ...emptyPermissions(), ...row.permissions },
	};
}

/** Resolve Better Auth first, then the retained legacy compatibility session. */
export async function verifyBrowserRequest(
	db: Db,
	request: Request,
): Promise<BrowserSessionPrincipal | null> {
	return (
		(await verifyBrowserPrincipal(db, request)) ??
		(await verifyLegacyBrowserPrincipal(db, request))
	);
}
