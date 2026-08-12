import { isBearerTokenValid } from "@virtool/contracts/bearer";
import type { PgClient } from "@virtool/data/db/pg";
import { readConnectionCountsBounded } from "@virtool/data/metrics/data";
import type { Logger } from "@virtool/logger";
import type { ProbeResponse } from "../probes";
import type { TaskQueueReader } from "./queue";
import type { Metrics } from "./registry";

/** What {@link handleMetrics} needs to answer a scrape. */
export type MetricsDeps = {
	metrics: Metrics;
	logger: Logger;
	client: PgClient;
	applicationName: string;
	/**
	 * Refreshes the queue gauges on scrape.
	 *
	 * Every replica publishes them — N replicas each running this scan against
	 * the same table on every scrape reports N copies of one number, but the
	 * table is small and a dashboard picks one target, so it is accepted waste
	 * rather than a problem; there is no flag to make it conditional. Optional
	 * here only so a caller with none to give can still exercise the rest of
	 * the scrape.
	 */
	readTaskQueue: TaskQueueReader | undefined;
	/** The request's `Authorization` header, verbatim. */
	authorization: string | undefined;
	token: string | undefined;
};

/**
 * Answer a Prometheus scrape at `GET /metrics`.
 *
 * This process has no Service and is unreachable from outside the cluster, but
 * the token is not redundant: the listener answers anything that can route to
 * the pod IP. With no token configured it reports **404** rather than serving
 * openly, so an existing deployment does not start exposing internals on
 * upgrade; with a token configured and a wrong one presented it reports
 * **401**.
 *
 * `isBearerTokenValid` is shared with `apps/web` and `apps/jobs-api` rather
 * than reimplemented. It screens the length before `timingSafeEqual`, which
 * throws on a length mismatch — reducing the comparison to `===` reintroduces
 * the timing leak the shared helper exists to close.
 *
 * How these pods actually get scraped is unsettled. A `prometheus.io/scrape`
 * annotation needs no Service and yields genuine per-pod series, but cannot
 * carry a bearer token — under the semantics here that means no metrics at all
 * rather than open metrics. If that is the route taken, this handler needs a
 * deliberate third state; do not reach it by quietly dropping the gate.
 *
 * Postgres pool occupancy is read the same way as `apps/web` and
 * `apps/jobs-api` — `readConnectionCountsBounded`, filtered on this process's
 * `application_name` — because the task runner's claim and heartbeat loops
 * make its pool just as worth watching as either of theirs.
 */
export async function handleMetrics(deps: MetricsDeps): Promise<ProbeResponse> {
	if (!deps.token) {
		return { status: 404, body: "Not Found", headers: {} };
	}

	if (!isBearerTokenValid(deps.authorization, deps.token)) {
		return {
			status: 401,
			body: "Unauthorized",
			headers: { "www-authenticate": "Bearer" },
		};
	}

	// The two reads are independent, so one failing does not take the other's
	// series with it. A Postgres outage is exactly when the rest of these
	// metrics matter most, so each drops only the gauges it feeds rather than
	// failing the whole scrape.
	await Promise.all([
		(async () => {
			try {
				deps.metrics.setPostgresConnections(
					await readConnectionCountsBounded(deps.client, deps.applicationName),
				);
			} catch (err) {
				deps.logger.warn({ err }, "could not read postgres connection counts");
			}
		})(),

		(async () => {
			if (!deps.readTaskQueue) {
				return;
			}

			try {
				deps.metrics.setTaskQueue(await deps.readTaskQueue());
			} catch (err) {
				// Dropped rather than left to go stale: a queue depth is only
				// meaningful as of a moment, and re-serving the last one would have
				// Prometheus record it as fresh on every scrape of the outage.
				deps.metrics.clearTaskQueue();
				deps.logger.warn({ err }, "could not read task queue counts");
			}
		})(),
	]);

	return {
		status: 200,
		body: await deps.metrics.render(),
		headers: { "content-type": deps.metrics.contentType },
	};
}
