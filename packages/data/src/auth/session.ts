import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type SessionRow, sessions } from "../db/schema/sessions";
import { hashToken, newSessionId, newSessionToken } from "./tokens";

// Python lifetimes in `virtool/sessions/data.py`:
//   - authenticated + remember: 30 days
//   - authenticated, no remember: 60 minutes
//   - reset: 10 minutes
// We mirror them so a row written here is indistinguishable from one written
// by the Python backend.
const SESSION_LIFETIME_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_LIFETIME_NO_REMEMBER_MS = 60 * 60 * 1000;
const RESET_LIFETIME_MS = 10 * 60 * 1000;

/** Inputs to mint an authenticated session row. */
export type CreateAuthenticatedSessionInput = {
	userId: number;
	ip: string;
	remember: boolean;
};

/** Output: the cookie values the caller must set, plus the inserted row. */
export type CreateAuthenticatedSessionResult = {
	sessionId: string;
	token: string;
	row: SessionRow;
};

export async function createAuthenticatedSession(
	db: DbOrTx,
	{ userId, ip, remember }: CreateAuthenticatedSessionInput,
): Promise<CreateAuthenticatedSessionResult> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const tokenHash = hashToken(token);
	const now = new Date();
	const lifetime = remember
		? SESSION_LIFETIME_REMEMBER_MS
		: SESSION_LIFETIME_NO_REMEMBER_MS;
	const expiresAt = new Date(now.getTime() + lifetime);

	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt,
				tokenHash,
				sessionType: "authenticated",
			})
			.returning(),
	);

	return { sessionId, token, row };
}

/** Inputs to mint a forced-reset session row. */
export type CreateResetSessionInput = {
	userId: number;
	ip: string;
	remember: boolean;
};

/** Output: the session_id cookie value, the reset_code returned to the client, and the row. */
export type CreateResetSessionResult = {
	sessionId: string;
	resetCode: string;
	row: SessionRow;
};

export async function createResetSession(
	db: DbOrTx,
	{ userId, ip, remember }: CreateResetSessionInput,
): Promise<CreateResetSessionResult> {
	const sessionId = newSessionId();
	const resetCode = randomBytes(32).toString("hex");
	const now = new Date();
	const expiresAt = new Date(now.getTime() + RESET_LIFETIME_MS);

	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt,
				resetCode,
				resetRemember: remember,
				sessionType: "reset",
			})
			.returning(),
	);

	return { sessionId, resetCode, row };
}

export async function invalidateSession(
	db: DbOrTx,
	sessionId: string,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

/**
 * Delete a reset session, reporting whether this call is the one that consumed
 * it. False means it was already spent (or never existed).
 *
 * A reset code is single-use, but nothing between reading it and writing the
 * new password holds a lock — and the bcrypt hash in that gap is slow. Called
 * inside the reset transaction, this is the point two concurrent resets for the
 * same code serialize on: the second blocks on the row lock, then finds nothing
 * to delete and rolls back rather than clobbering the session the first minted.
 */
export async function consumeResetSession(
	db: DbOrTx,
	sessionId: string,
): Promise<boolean> {
	const rows = await db
		.delete(sessions)
		.where(
			and(eq(sessions.sessionId, sessionId), eq(sessions.sessionType, "reset")),
		)
		.returning({ sessionId: sessions.sessionId });

	return rows.length > 0;
}

export async function invalidateUserSessions(
	db: DbOrTx,
	userId: number,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}
