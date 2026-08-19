import { createHash, randomBytes } from "node:crypto";

const SESSION_ID_PREFIX = "session_";

/** Generate a new opaque session_id: `"session_"` plus 96 hex characters. */
export function newSessionId(): string {
	return SESSION_ID_PREFIX + randomBytes(48).toString("hex");
}

/** Generate a new opaque session_token. Only its SHA-256 is stored. */
export function newSessionToken(): string {
	return randomBytes(32).toString("hex");
}

/**
 * Generate the key a runner authenticates its job with. Only its SHA-256 is
 * stored, and the plaintext is returned to the runner exactly once, in the
 * claim response.
 *
 * 32 random bytes, 64 hex characters — the width `jobs.key` holds, and the
 * width every key already stored there was generated at.
 */
export function newJobKey(): string {
	return randomBytes(32).toString("hex");
}

/** SHA-256 hex digest, the form every stored key and token is held in. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}
