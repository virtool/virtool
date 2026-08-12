import { type SQL, sql } from "drizzle-orm";

/**
 * The current UTC wall time, matching the naive `timestamp` columns Python
 * writes.
 *
 * `clock_timestamp()` rather than `now()`, which is the *transaction's* start
 * time and is frozen for its whole length. On a heartbeat that back-dates the
 * lease by however long the transaction has already run, which is the
 * difference between a renewed lease and one another runner is free to take.
 */
export function nowUtc(): SQL {
	return sql`timezone('utc', clock_timestamp())`;
}

/**
 * The wall time `seconds` before now, in the naive UTC these columns hold.
 *
 * A lease is live while `acquired_at` is later than this, a periodic task's
 * spawn is suppressed while a `created_at` of that type is later than it, and a
 * cache is old enough to evict once its `last_accessed_at` is earlier than it.
 */
export function secondsAgo(seconds: number): SQL {
	return sql`${nowUtc()} - make_interval(secs => ${seconds}::double precision)`;
}
