import { isBearerTokenValid } from "@virtool/contracts/bearer";
import type { PgClient } from "@virtool/data/db/pg";
import {
	type ConnectionCounts,
	readConnectionCountsBounded,
} from "@virtool/data/metrics/data";
import type { Logger } from "@virtool/logger";

/** A scrape response, before a transport writes it out. */
export type MetricsResponse = {
	status: number;
	body: string;
	headers: Record<string, string>;
};

/** A gauge family refreshed on every scrape, and how to drop it when the refresh fails. */
export type MetricsSource = {
	/** A bounded name for the source, logged when its refresh fails. */
	name: string;
	refresh: () => Promise<void>;
	clear: () => void;
};

/** What {@link scrapeMetrics} needs to answer a scrape. */
export type ScrapeMetricsOptions = {
	authorization: string | undefined;
	token: string | undefined;
	logger: Logger;
	sources: MetricsSource[];
	contentType: string;
	render: () => Promise<string>;
};

/** The registry handles the Postgres connection source writes to. */
type PostgresConnectionGauges = {
	setPostgresConnections: (counts: ConnectionCounts) => void;
	clearPostgresConnections: () => void;
};

/** Build the source that refreshes this process's Postgres connection gauges. */
export function postgresConnectionsSource(
	client: PgClient,
	applicationName: string,
	gauges: PostgresConnectionGauges,
): MetricsSource {
	return {
		name: "postgres_connections",
		async refresh() {
			gauges.setPostgresConnections(
				await readConnectionCountsBounded(client, applicationName),
			);
		},
		clear: gauges.clearPostgresConnections,
	};
}

/**
 * Answer a Prometheus scrape at `GET /metrics`.
 *
 * With no token configured it reports **404** rather than serving openly, so an
 * existing deployment does not start exposing internals on upgrade; with a
 * token configured and a wrong one presented it reports **401**.
 *
 * A Postgres outage is exactly when the rest of these metrics matter most, so a
 * failed refresh drops only the series its source feeds, not the whole scrape.
 * The sources are independent, so one failing does not take another's series
 * with it. A failed source is cleared, not left at its last value: a gauge is
 * only meaningful as of a moment, and re-serving the last one would have
 * Prometheus record it as fresh on every scrape of the outage. An absent series
 * says "unknown", and `absent()` can alert on it.
 */
export async function scrapeMetrics(
	options: ScrapeMetricsOptions,
): Promise<MetricsResponse> {
	if (!options.token) {
		return { status: 404, body: "Not Found", headers: {} };
	}

	if (!isBearerTokenValid(options.authorization, options.token)) {
		return {
			status: 401,
			body: "Unauthorized",
			headers: { "www-authenticate": "Bearer" },
		};
	}

	await Promise.all(
		options.sources.map(async (source) => {
			try {
				await source.refresh();
			} catch (err) {
				source.clear();
				options.logger.warn(
					{ err, source: source.name },
					"could not refresh a metrics source",
				);
			}
		}),
	);

	return {
		status: 200,
		body: await options.render(),
		headers: { "content-type": options.contentType },
	};
}
