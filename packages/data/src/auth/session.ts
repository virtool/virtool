import { randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type SessionRow, sessions } from "../db/schema/sessions";
import { nowUtc } from "../db/time";
import { hashToken, newSessionId, newSessionToken } from "./tokens";

/**
 * How long an authenticated session lasts when the user ticked "remember me".
 */
const SESSION_LIFETIME_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long an authenticated session lasts when the user did not.
 */
const SESSION_LIFETIME_NO_REMEMBER_MS = 60 * 60 * 1000;

/**
 * How long a forced-reset session lasts.
 */
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

/**
 * How many expired sessions one statement removes.
 *
 * Low thousands, so a single pass is short enough that nothing else waiting on
 * a `sessions` row waits long, and few enough passes are needed that the loop
 * is not itself the cost. The first production run clears years of accumulated
 * rows, which is the run this bound exists for.
 */
const SESSION_CLEANUP_BATCH_SIZE = 2_000;

/** What {@link deleteExpiredSessions} accepts. */
export type DeleteExpiredSessionsOptions = {
	/** Rows removed per statement. Defaults to {@link SESSION_CLEANUP_BATCH_SIZE}. */
	batchSize?: number;
	/** Aborts the loop between batches. Committed batches stand. */
	signal?: AbortSignal;
};

/**
 * Delete every session row whose `expires_at` has passed, and report how many
 * went.
 *
 * **The delete is batched, and each batch is its own transaction.** A single
 * statement covering years of accumulated rows would hold every one of their
 * locks and pin `xmin` for its whole duration, stalling autovacuum across the
 * database rather than just this table. Nothing here opens a transaction, so a
 * `db` handle runs each statement autocommitted; passing a transaction instead
 * folds the whole loop into it and gives back exactly the long-running delete
 * being avoided.
 *
 * **The cutoff is Postgres's clock, never a `Date` bound from here.**
 * `expires_at` is `timestamp without time zone` holding naive UTC, and a
 * JavaScript `Date` bound against it casts through the session `TimeZone` —
 * unset in this pool, so the offset is silent and hour-scale. Deleting a live
 * session logs a user out early, which is the only harm this can do.
 *
 * **The expiry test is repeated on the outer `delete`**, where it looks
 * redundant against the subquery that already applied it. Under Read Committed
 * a row updated by a transaction that commits mid-statement is re-checked
 * against the outer `where` alone — the subquery is not re-run — so a predicate
 * naming only the id passes on a row whose `expires_at` has since moved
 * forward, and a session Python's sliding refresh just extended is deleted out
 * from under its user.
 *
 * The loop stops on a batch shorter than the limit. A concurrent logout that
 * removes an expired row between the select and the delete, or a refresh the
 * re-check then spares, can end a run one batch early; the next run takes what
 * is left, and no run deletes a row it should not have.
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
