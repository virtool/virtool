import type { PgClient } from "../db/pg";

/** How Postgres reports a backend's state in `pg_stat_activity`. */
const ACTIVE = "active";
const IDLE = "idle";
const IDLE_IN_TRANSACTION = "idle in transaction";
const IDLE_IN_TRANSACTION_ABORTED = "idle in transaction (aborted)";

/** Occupancy of this process's Postgres pool, grouped by backend state. */
export type ConnectionCounts = {
	active: number;
	idle: number;
	idleInTransaction: number;
	other: number;
};

/** Fold a raw `pg_stat_activity` state into one of the reported buckets. */
function bucketFor(state: string | null): keyof ConnectionCounts {
	switch (state) {
		case ACTIVE:
			return "active";
		case IDLE:
			return "idle";
		case IDLE_IN_TRANSACTION:
		case IDLE_IN_TRANSACTION_ABORTED:
			return "idleInTransaction";
		default:
			return "other";
	}
}

/**
 * Count this process's open Postgres backends by state.
 *
 * Postgres' own view of the connections is the only one available: postgres.js
 * holds its pool queues in a closure and offers no statistics API, and its one
 * user-facing lifecycle callback (`onclose`) has no `onopen` counterpart to
 * balance it. Filtering on `applicationName` — which carries the hostname —
 * narrows the view to the backends this process opened.
 *
 * This cannot see queries queued *client-side* waiting for a free pool slot,
 * which is the true saturation signal. That lives in the postgres.js closure
 * and needs per-query instrumentation to recover.
 */
export async function readConnectionCounts(
	client: PgClient,
	applicationName: string,
): Promise<ConnectionCounts> {
	const rows = await client<{ state: string | null; count: number }[]>`
		SELECT state, count(*)::int AS count
		FROM pg_stat_activity
		WHERE application_name = ${applicationName}
			AND datname = current_database()
		GROUP BY state
	`;

	const counts: ConnectionCounts = {
		active: 0,
		idle: 0,
		idleInTransaction: 0,
		other: 0,
	};

	for (const row of rows) {
		counts[bucketFor(row.state)] += row.count;
	}

	return counts;
}
