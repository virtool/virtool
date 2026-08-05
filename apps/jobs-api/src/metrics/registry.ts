import type { ConnectionCounts } from "@virtool/data/metrics/data";
import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";

/** One handled request, as observed by the metrics middleware. */
export type RequestSample = {
	method: string;
	/**
	 * The route's registered path pattern — `/jobs/:jobId`, not `/jobs/1234`.
	 *
	 * The pattern is what keeps this label bounded. A real pathname carries ids,
	 * and one time series per job would grow without limit.
	 */
	route: string;
	/** The response status, or `"error"` when the handler threw instead. */
	status: string;
	durationSeconds: number;
};

/** The metrics surface this process exposes, as returned by {@link createMetrics}. */
export type Metrics = {
	recordHttpRequest: (sample: RequestSample) => void;
	setPostgresConnections: (counts: ConnectionCounts) => void;
	contentType: string;
	render: () => Promise<string>;
};

/**
 * Build this process's Prometheus registry and the handles that write to it.
 *
 * A factory rather than a module-scope singleton, so a test gets its own
 * registry and cannot see what another suite happened to register. It is also
 * why nothing here reads configuration: `poolMax` arrives as an argument, the
 * way `@virtool/data` and `@virtool/storage` take theirs.
 *
 * This is a *separate registry from the web app's*, in a separate process. The
 * series names deliberately match, so one dashboard works for both; the two are
 * told apart by the scrape's target labels and by `application_name` in
 * `pg_stat_activity`, not by renaming the metrics.
 */
export function createMetrics(poolMax: number): Metrics {
	const registry = new Registry();

	// Standard `process_*` and `nodejs_*` series: RSS, heap, CPU, GC, open
	// handles, and event loop lag. Left unprefixed on purpose — off-the-shelf
	// Node dashboards and alerting rules match these names exactly.
	collectDefaultMetrics({ register: registry });

	const httpRequests = new Counter({
		name: "virtool_http_requests_total",
		help: "HTTP requests handled, by route, method, and response status.",
		labelNames: ["route", "method", "status"],
		registers: [registry],
	});

	const httpDuration = new Histogram({
		name: "virtool_http_request_duration_seconds",
		help: "Time from request receipt to response headers, in seconds.",
		labelNames: ["route", "method"],
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [registry],
	});

	const postgresConnections = new Gauge({
		name: "virtool_postgres_connections",
		help: "Open Postgres backends belonging to this process, by backend state.",
		labelNames: ["state"],
		registers: [registry],
	});

	// Static, but it is the denominator: pool saturation is only legible as
	// `virtool_postgres_connections / virtool_postgres_pool_max`.
	new Gauge({
		name: "virtool_postgres_pool_max",
		help: "Maximum size of this process's Postgres connection pool.",
		registers: [registry],
	}).set(poolMax);

	return {
		recordHttpRequest(sample) {
			const { method, route } = sample;

			httpRequests.inc({ route, method, status: sample.status });
			httpDuration.observe({ route, method }, sample.durationSeconds);
		},

		setPostgresConnections(counts) {
			postgresConnections.set({ state: "active" }, counts.active);
			postgresConnections.set({ state: "idle" }, counts.idle);
			postgresConnections.set(
				{ state: "idle in transaction" },
				counts.idleInTransaction,
			);
			postgresConnections.set({ state: "other" }, counts.other);
		},

		contentType: registry.contentType,

		render: () => registry.metrics(),
	};
}
