import { createHash, randomBytes } from "node:crypto";

const SESSION_ID_PREFIX = "session_";

/** Generate a new opaque session_id matching Python's `"session_" + 96 hex`. */
export function newSessionId(): string {
	return SESSION_ID_PREFIX + randomBytes(48).toString("hex");
}

/** Generate a new opaque session_token. Only its SHA-256 is stored. */
export function newSessionToken(): string {
	return randomBytes(32).toString("hex");
}

/** SHA-256 hex digest. Mirrors Python `virtool.utils.hash_key`. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}
