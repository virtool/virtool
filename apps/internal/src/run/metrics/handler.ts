import type { PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import {
	type MetricsResponse,
	type MetricsSource,
	postgresConnectionsSource,
	scrapeMetrics,
} from "../../metrics/handler";
import type { TaskQueueReader } from "./queue";
import type { Metrics } from "./registry";

/** What {@link handleMetrics} needs to answer a scrape. */
export type MetricsDeps = {
	metrics: Metrics;
	logger: Logger;
	client: PgClient;
	applicationName: string;
	readTaskQueue: TaskQueueReader | undefined;
	authorization: string | undefined;
	token: string | undefined;
};

/**
 * Answer a Prometheus scrape at `GET /metrics` on the probe listener.
 *
 * This process has no Service and is unreachable from outside the cluster, but
 * the token is not redundant: the listener answers anything that can route to
 * the pod IP.
 *
 * How these pods actually get scraped is unsettled. A `prometheus.io/scrape`
 * annotation needs no Service and yields genuine per-pod series, but cannot
 * carry a bearer token — under the semantics here that means no metrics at all
 * rather than open metrics. If that is the route taken, this handler needs a
 * deliberate third state; do not reach it by quietly dropping the gate.
 */
export function handleMetrics(deps: MetricsDeps): Promise<MetricsResponse> {
	const { metrics, readTaskQueue } = deps;

	const sources: MetricsSource[] = [
		postgresConnectionsSource(deps.client, deps.applicationName, metrics),
	];

	if (readTaskQueue) {
		sources.push({
			name: "task_queue",
			refresh: async () => metrics.setTaskQueue(await readTaskQueue()),
			clear: metrics.clearTaskQueue,
		});
	}

	return scrapeMetrics({
		authorization: deps.authorization,
		token: deps.token,
		logger: deps.logger,
		sources,
		contentType: metrics.contentType,
		render: metrics.render,
	});
}
