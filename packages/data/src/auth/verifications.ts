import { sql } from "drizzle-orm";
import type { DbOrTx } from "../db/pg";
import { authVerifications } from "../db/schema/auth";
import { nowUtc } from "../db/time";

/** Rows removed per statement so the sweep does not hold every row lock at once. */
const VERIFICATION_CLEANUP_BATCH_SIZE = 2_000;

/** Options for deleting expired Better Auth verification rows. */
export type DeleteExpiredVerificationsOptions = {
	/** Rows removed per statement. */
	batchSize?: number;
	/** Aborts the loop between batches. */
	signal?: AbortSignal;
};

/**
 * Delete every expired Better Auth verification row.
 *
 * Better Auth deletes expired rows only when it looks a row up with
 * `findVerificationValue`, which Virtool reaches only on TOTP sign-in. A
 * passkey challenge that is issued and never answered stays until this runs.
 * Better Auth rejects an expired row whatever reads it, so deleting one changes
 * no outcome.
 *
 * Postgres supplies the cutoff because `expires_at` is a naive UTC timestamp
 * and binding a JavaScript `Date` would cast it through the connection time
 * zone. The outer expiry check keeps a row that is updated after the subquery
 * selects it but before the delete acquires its row lock.
 */
export async function deleteExpiredVerifications(
	db: DbOrTx,
	{
		batchSize = VERIFICATION_CLEANUP_BATCH_SIZE,
		signal,
	}: DeleteExpiredVerificationsOptions = {},
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
			.delete(authVerifications)
			.where(
				sql`${authVerifications.expiresAt} < ${nowUtc()} and ${authVerifications.id} in (
					select id from ${authVerifications}
					where expires_at < ${nowUtc()}
					limit ${batchSize}
				)`,
			)
			.returning({ id: authVerifications.id });

		total += deleted.length;

		if (deleted.length < batchSize) {
			return total;
		}
	}
}
