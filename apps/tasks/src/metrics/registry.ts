import { collectDefaultMetrics, Gauge, Registry } from "prom-client";

/** The metrics surface this process exposes, as returned by {@link createMetrics}. */
export type Metrics = {
	contentType: string;
	render: () => Promise<string>;
};

/**
 * Build this process's Prometheus registry.
 *
 * A factory rather than a module-scope singleton, so a test gets its own
 * registry and cannot see what another suite happened to register — and so
 * importing this module does no work. `version` arrives as an argument for the
 * same reason nothing here reads configuration.
 *
 * This is a *separate registry from the web app's and the jobs API's*, in a
 * separate process. Series names deliberately match where they overlap, so one
 * dashboard works across all three; the processes are told apart by the
 * scrape's target labels, not by renaming a metric.
 *
 * Only the process defaults and `virtool_app_info` are registered. The
 * `virtool_http_*` series are web-specific — their buckets top out at 10 s, and
 * this process serves nothing but probes — and the task and queue series belong
 * to the issues that add the claim and spawn loops.
 */
export function createMetrics(version: string): Metrics {
	const registry = new Registry();

	// Standard `process_*` and `nodejs_*` series: RSS, heap, CPU, GC, open
	// handles, and event loop lag. Left unprefixed on purpose — off-the-shelf
	// Node dashboards and alerting rules match these names exactly. Event loop
	// lag is the one that matters most here: a CPU-bound task body starves the
	// loop, and that is invisible in every other series.
	collectDefaultMetrics({ register: registry });

	// The conventional `_info` shape: a gauge pinned at 1 whose labels carry the
	// facts. Joining it onto other series in a query is what correlates a change
	// in behaviour with the deploy that caused it.
	new Gauge({
		name: "virtool_app_info",
		help: "Build information for the running process, always set to 1.",
		labelNames: ["version"],
		registers: [registry],
	}).set({ version }, 1);

	return {
		contentType: registry.contentType,
		render: () => registry.metrics(),
	};
}
