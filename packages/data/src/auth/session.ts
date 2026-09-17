import { sql } from "drizzle-orm";

import type { DbOrTx } from "../db/pg";
import { authSessions } from "../db/schema/auth";
import { nowUtc } from "../db/time";

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
 * Delete every expired Better Auth session and return the number removed.
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
			return total;
		}
	}
}
