import type { ConnectionCounts } from "@virtool/data/metrics/data";
import { HTTP_REQUEST_DURATION_BUCKETS } from "@virtool/data/metrics/httpBuckets";
import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";
import { config } from "../config";

/**
 * The process-wide Prometheus registry.
 *
 * Private rather than a re-export of prom-client's global default, so a test
 * can render it without picking up whatever another suite happened to register.
 */
const registry = new Registry();

// Standard `process_*` and `nodejs_*` series: RSS, heap, CPU, GC, open handles,
// and event loop lag. Left unprefixed on purpose — off-the-shelf Node dashboards
// and alerting rules match these names exactly.
collectDefaultMetrics({ register: registry });

// The conventional `_info` shape: a gauge pinned at 1 whose labels carry the
// facts. Joining it onto other series in a query is what correlates a change in
// behaviour with the deploy that caused it.
new Gauge({
	name: "virtool_app_info",
	help: "Build information for the running server, always set to 1.",
	labelNames: ["version"],
	registers: [registry],
}).set({ version: __APP_VERSION__ }, 1);

const httpRequests = new Counter({
	name: "virtool_http_requests_total",
	help: "HTTP requests handled, by handler type, method, and response status.",
	labelNames: ["handler_type", "method", "status", "server_fn"],
	registers: [registry],
});

const httpDuration = new Histogram({
	name: "virtool_http_request_duration_seconds",
	help: "Time from request receipt to response headers, in seconds.",
	labelNames: ["handler_type", "method", "server_fn"],
	buckets: HTTP_REQUEST_DURATION_BUCKETS,
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
}).set(config.postgresPoolMax);

/** One handled request, as observed by the global request middleware. */
export type RequestSample = {
	handlerType: string;
	method: string;
	/** The response status, or `"error"` when the handler threw instead. */
	status: string;
	/** The server function's export name, or `""` for a router request. */
	serverFn: string;
	durationSeconds: number;
};

/** Record one handled request against the request counter and histogram. */
export function recordHttpRequest(sample: RequestSample): void {
	const { handlerType, method, serverFn } = sample;

	httpRequests.inc({
		handler_type: handlerType,
		method,
		status: sample.status,
		server_fn: serverFn,
	});

	httpDuration.observe(
		{ handler_type: handlerType, method, server_fn: serverFn },
		sample.durationSeconds,
	);
}

/** Publish the latest Postgres pool occupancy ahead of a scrape. */
export function setPostgresConnections(counts: ConnectionCounts): void {
	postgresConnections.set({ state: "active" }, counts.active);
	postgresConnections.set({ state: "idle" }, counts.idle);
	postgresConnections.set(
		{ state: "idle in transaction" },
		counts.idleInTransaction,
	);
	postgresConnections.set({ state: "other" }, counts.other);
}

/** The `Content-Type` a Prometheus scrape expects for the rendered body. */
export const metricsContentType = registry.contentType;

/** Render every registered metric in the Prometheus text exposition format. */
export function renderMetrics(): Promise<string> {
	return registry.metrics();
}
