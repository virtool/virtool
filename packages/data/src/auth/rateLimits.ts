import { sql } from "drizzle-orm";

import type { Db } from "../db/pg";
import { authRateLimits } from "../db/schema/auth";

// The longest window of any budget kept in `auth_rate_limits`: the recovery
// target budget. A row older than this can't affect any budget.
const RATE_LIMIT_RETENTION_MS = 60 * 60_000;

const RATE_LIMIT_PRUNE_BATCH_SIZE = 2_000;

/** Delete rate-limit rows whose window has ended for every budget. */
export async function pruneAuthRateLimits(
	db: Db,
	signal?: AbortSignal,
): Promise<number> {
	// Postgres's clock, so a fast task host can't delete a row early.
	const cutoff = sql`floor(extract(epoch from clock_timestamp()) * 1000) - ${RATE_LIMIT_RETENTION_MS}`;
	let total = 0;

	for (;;) {
		signal?.throwIfAborted();

		const deleted = await db
			.delete(authRateLimits)
			.where(
				sql`${authRateLimits.lastRequest} < ${cutoff} and ${authRateLimits.id} in (
					select id from ${authRateLimits}
					where last_request < ${cutoff}
					limit ${RATE_LIMIT_PRUNE_BATCH_SIZE}
				)`,
			)
			.returning({ id: authRateLimits.id });

		total += deleted.length;

		if (deleted.length < RATE_LIMIT_PRUNE_BATCH_SIZE) {
			return total;
		}
	}
}
