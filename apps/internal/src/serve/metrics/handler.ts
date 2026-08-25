import { isBearerTokenValid } from "@virtool/contracts/bearer";
import type { PgClient } from "@virtool/data/db/pg";
import { readConnectionCountsBounded } from "@virtool/data/metrics/data";
import type { Logger } from "@virtool/logger";
import type { Context } from "hono";
import type { JobQueueReader } from "./jobs";
import type { Metrics } from "./registry";

/** What {@link handleMetrics} needs to answer a scrape. */
export type MetricsDeps = {
	metrics: Metrics;
	client: PgClient;
	applicationName: string;
	readJobQueue: JobQueueReader;
	logger: Logger;
	token: string | undefined;
};

/**
 * Answer a Prometheus scrape at `GET /metrics`.
 *
 * This service is already unreachable from the internet, but the token is not
 * redundant: everything inside the cluster can reach a ClusterIP, and the
 * endpoint shares a socket with the API itself. With no token configured it
 * reports **404** rather than serving openly, so an existing deployment does
 * not start exposing internals on upgrade; with a token configured and a wrong
 * one presented it reports **401**.
 */
export async function handleMetrics(
	c: Context,
	deps: MetricsDeps,
): Promise<Response> {
	if (!deps.token) {
		return c.text("Not Found", 404);
	}

	if (!isBearerTokenValid(c.req.header("authorization"), deps.token)) {
		return c.text("Unauthorized", 401, { "www-authenticate": "Bearer" });
	}

	// A Postgres outage is exactly when the rest of these metrics matter most, so
	// a failed or slow read drops only the gauges it feeds rather than the whole
	// scrape. Those series go stale at their last value; `up` and the process
	// metrics carry on. The two reads are independent, so one failing does not
	// take the other's series with it.
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
			try {
				deps.metrics.setJobQueue(await deps.readJobQueue());
			} catch (err) {
				// Unlike the pool gauges above, these are dropped rather than left
				// to go stale: a queue depth is only meaningful as of a moment, and
				// re-serving the last one would have Prometheus record it as fresh
				// on every scrape of the outage.
				deps.metrics.clearJobQueue();
				deps.logger.warn({ err }, "could not read job queue counts");
			}
		})(),
	]);

	return c.text(await deps.metrics.render(), 200, {
		"content-type": deps.metrics.contentType,
	});
}
