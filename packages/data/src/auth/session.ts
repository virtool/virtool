import { and, eq, sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { authSessions } from "../db/schema/auth";
import { type SessionRow, sessions } from "../db/schema/sessions";
import { nowUtc } from "../db/time";
import { hashToken, newSessionId, newSessionToken } from "./tokens";

const SESSION_LIFETIME_MS = 60 * 60 * 1000;
const RESET_LIFETIME_MS = 10 * 60 * 1000;

/** Inputs to mint a temporary legacy authenticated session. */
export type CreateAuthenticatedSessionInput = {
	userId: number;
	ip: string;
};

/** A temporary legacy authenticated session and its plaintext cookie values. */
export type CreateAuthenticatedSessionResult = {
	sessionId: string;
	token: string;
	row: SessionRow;
};

/** Mint a one-hour legacy session during the staged authentication cutover. */
export async function createAuthenticatedSession(
	db: DbOrTx,
	{ userId, ip }: CreateAuthenticatedSessionInput,
): Promise<CreateAuthenticatedSessionResult> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const now = new Date();
	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
				tokenHash: hashToken(token),
				sessionType: "authenticated",
			})
			.returning(),
	);

	return { sessionId, token, row };
}

/** Inputs to mint a temporary legacy forced-reset session. */
export type CreateResetSessionInput = {
	userId: number;
	ip: string;
};

/** A temporary legacy reset session and its plaintext cookie token. */
export type CreateResetSessionResult = {
	sessionId: string;
	token: string;
	row: SessionRow;
};

/** Mint a legacy reset session during the staged authentication cutover. */
export async function createResetSession(
	db: DbOrTx,
	{ userId, ip }: CreateResetSessionInput,
): Promise<CreateResetSessionResult> {
	const sessionId = newSessionId();
	const token = newSessionToken();
	const now = new Date();
	const row = takeFirstOrThrow(
		await db
			.insert(sessions)
			.values({
				sessionId,
				userId,
				ip,
				createdAt: now,
				expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS),
				tokenHash: hashToken(token),
				sessionType: "reset",
			})
			.returning(),
	);

	return { sessionId, token, row };
}

/** Invalidate one retained legacy browser session. */
export async function invalidateSession(
	db: DbOrTx,
	sessionId: string,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

/** Invalidate every retained legacy browser session for a user. */
export async function invalidateUserSessions(
	db: DbOrTx,
	userId: number,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Atomically consume a retained legacy forced-reset session. */
export async function consumeResetSession(
	db: DbOrTx,
	sessionId: string,
): Promise<boolean> {
	const deleted = await db
		.delete(sessions)
		.where(
			and(eq(sessions.sessionId, sessionId), eq(sessions.sessionType, "reset")),
		)
		.returning({ id: sessions.id });
	return deleted.length === 1;
}

/** Rows removed per statement so the sweep does not hold every row lock at once. */
const SESSION_CLEANUP_BATCH_SIZE = 2_000;

/** Options for deleting expired application sessions. */
export type DeleteExpiredSessionsOptions = {
	/** Rows removed per statement. */
	batchSize?: number;
	/** Aborts the loop between batches. */
	signal?: AbortSignal;
};

/**
 * Delete every expired Better Auth and retained legacy session.
 *
 * Each batch autocommits when `db` is a database handle, keeping the delete
 * from holding every expired row lock until the full sweep finishes. Postgres
 * supplies the cutoff because `expires_at` is a naive UTC timestamp and
 * binding a JavaScript `Date` would cast it through the connection time zone.
 *
 * The outer expiry check protects a session that Better Auth refreshes after
 * the subquery selects it but before the delete acquires its row lock.
 */
export async function deleteExpiredSessions(
	db: DbOrTx,
	{
		batchSize = SESSION_CLEANUP_BATCH_SIZE,
		signal,
	}: DeleteExpiredSessionsOptions = {},
): Promise<number> {
	if (!Number.isInteger(batchSize) || batchSize < 1) {
		throw new RangeError(
			`batchSize must be a positive integer, got ${batchSize}`,
		);
	}

	let total = 0;

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(authSessions)
			.where(
				sql`${authSessions.expiresAt} < ${nowUtc()} and ${authSessions.id} in (
					select id from ${authSessions}
					where expires_at < ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: authSessions.id });

		total += deleted.length;

		if (deleted.length < batchSize) {
			break;
		}
	}

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(sessions)
			.where(
				sql`${sessions.expiresAt} < ${nowUtc()} and ${sessions.id} in (
					select id from ${sessions}
					where expires_at < ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: sessions.id });

		total += deleted.length;
		if (deleted.length < batchSize) {
			return total;
		}
	}
}
