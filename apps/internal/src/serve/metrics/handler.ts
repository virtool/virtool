import type { PgClient } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import type { Context } from "hono";
import {
	postgresConnectionsSource,
	scrapeMetrics,
} from "../../metrics/handler";
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
 * Answer a Prometheus scrape at `GET /metrics` on the jobs API.
 *
 * This service is already unreachable from the internet, but the token is not
 * redundant: everything inside the cluster can reach a ClusterIP, and the
 * endpoint shares a socket with the API itself.
 */
export async function handleMetrics(
	c: Context,
	deps: MetricsDeps,
): Promise<Response> {
	const { metrics, readJobQueue } = deps;

	const response = await scrapeMetrics({
		authorization: c.req.header("authorization"),
		token: deps.token,
		logger: deps.logger,
		sources: [
			postgresConnectionsSource(deps.client, deps.applicationName, metrics),
			{
				name: "job_queue",
				refresh: async () => metrics.setJobQueue(await readJobQueue()),
				clear: metrics.clearJobQueue,
			},
		],
		contentType: metrics.contentType,
		render: metrics.render,
	});

	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
}
