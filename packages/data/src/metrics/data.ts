import type { PgClient } from "../db/pg";
import { withTimeout } from "../db/timeout";

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
 * How long a scrape waits on the pool probe before abandoning it.
 *
 * The probe is a query on the very pool it measures, so a saturated pool queues
 * it *client-side*, where nothing rejects and no statement timeout applies. Left
 * unbounded it would hang past Prometheus' scrape deadline and lose the whole
 * response — the process and request metrics included — exactly when saturation
 * is the thing worth seeing. Two seconds sits well inside a default 10s scrape
 * timeout.
 */
export const POOL_PROBE_TIMEOUT_MS = 2000;

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

/**
 * {@link readConnectionCounts}, bounded by {@link POOL_PROBE_TIMEOUT_MS}.
 *
 * This is what a `/metrics` handler should call. Both services expose pool
 * gauges and both need the same deadline for the same reason, so the timeout
 * lives here rather than being spelled out again beside each handler — a second
 * copy is free to drift to a value that no longer fits inside the scrape
 * timeout.
 *
 * Still throws on timeout or query failure. A caller drops the pool gauges and
 * logs, rather than failing the whole scrape: a Postgres outage is exactly when
 * the process and request metrics matter most.
 */
export function readConnectionCountsBounded(
	client: PgClient,
	applicationName: string,
	timeoutMs: number = POOL_PROBE_TIMEOUT_MS,
): Promise<ConnectionCounts> {
	return withTimeout(readConnectionCounts(client, applicationName), timeoutMs);
}
