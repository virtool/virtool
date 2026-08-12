import { JobWorkflow } from "@virtool/contracts";
import {
	type JobQueueSnapshot,
	NON_TERMINAL_JOB_STATES,
} from "@virtool/data/jobs/data";
import type { ConnectionCounts } from "@virtool/data/metrics/data";
import { HTTP_REQUEST_DURATION_BUCKETS } from "@virtool/data/metrics/httpBuckets";
import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";

/**
 * The label an unrecognised `jobs.workflow` value is folded into.
 *
 * `workflow` is a plain `text` column with no enum constraint, so "bounded by
 * construction" is only true if this side makes it so. A typo, or a workflow a
 * future Python release adds, must not mint a series that never retires.
 */
const OTHER_WORKFLOW = "other";

/** Every workflow label this process will ever emit. */
const WORKFLOW_LABELS = [...JobWorkflow.options, OTHER_WORKFLOW];

/**
 * The workflows that keep their own label.
 *
 * Deliberately not {@link WORKFLOW_LABELS}, which is the wider question of what
 * this process emits — a row whose workflow really is the string `other` is an
 * unrecognised workflow, not a recognised one.
 */
const KNOWN_WORKFLOWS = new Set<string>(JobWorkflow.options);

/** The states a row may be counted under, as a set for the guard below. */
const COUNTABLE_STATES = new Set<string>(NON_TERMINAL_JOB_STATES);

function workflowLabel(workflow: string): string {
	return KNOWN_WORKFLOWS.has(workflow) ? workflow : OTHER_WORKFLOW;
}

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
	setJobQueue: (snapshot: JobQueueSnapshot) => void;
	clearJobQueue: () => void;
	contentType: string;
	render: () => Promise<string>;
};

/**
 * Build this process's Prometheus registry and the handles that write to it.
 *
 * A factory rather than a module-scope singleton, so a test gets its own
 * registry and cannot see what another suite happened to register. It is also
 * why nothing here reads configuration: `poolMax` and `version` arrive as
 * arguments, the way `@virtool/data` and `@virtool/storage` take theirs.
 *
 * This is a *separate registry from the web app's*, in a separate process. The
 * series names deliberately match, so one dashboard works for both; the two are
 * told apart by the scrape's target labels and by `application_name` in
 * `pg_stat_activity`, not by renaming the metrics.
 */
export function createMetrics(poolMax: number, version: string): Metrics {
	const registry = new Registry();

	// Standard `process_*` and `nodejs_*` series: RSS, heap, CPU, GC, open
	// handles, and event loop lag. Left unprefixed on purpose — off-the-shelf
	// Node dashboards and alerting rules match these names exactly.
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
	}).set(poolMax);

	// The queue dimension. Workflow pods are one-shot Kubernetes Jobs — a poor
	// scrape target, since one may run for hours and vanish between scrapes, and
	// a pod-name label would be unbounded. The jobs API sees the whole fleet from
	// one place, over two labels that are bounded by construction.
	const jobsGauge = new Gauge({
		name: "virtool_jobs",
		help: "Jobs in a non-terminal state, by workflow and state.",
		labelNames: ["workflow", "state"],
		registers: [registry],
	});

	const oldestPendingJobAge = new Gauge({
		name: "virtool_jobs_oldest_pending_age_seconds",
		help: "Age of the oldest pending job, by workflow.",
		labelNames: ["workflow"],
		registers: [registry],
	});

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

		setJobQueue(snapshot) {
			// Write the whole cross product as zero first. A gauge holds its last
			// value forever, so a workflow that drains would otherwise report its
			// final backlog indefinitely — the worst possible failure for an alert
			// on queue depth.
			for (const workflow of WORKFLOW_LABELS) {
				oldestPendingJobAge.set({ workflow }, 0);

				for (const state of NON_TERMINAL_JOB_STATES) {
					jobsGauge.set({ workflow, state }, 0);
				}
			}

			// Folding several workflows onto `other` puts several rows on one
			// label, so counts add rather than overwrite. The state guard keeps the
			// label bounded here rather than relying on the query's `WHERE` to do
			// it from a distance.
			for (const row of snapshot.counts) {
				if (!COUNTABLE_STATES.has(row.state)) {
					continue;
				}

				jobsGauge.inc(
					{ workflow: workflowLabel(row.workflow), state: row.state },
					row.count,
				);
			}

			// An age does not add, so a folded label takes the oldest of what falls
			// into it — which is what "the oldest pending job" means for every
			// other label too.
			const oldest = new Map<string, number>();

			for (const row of snapshot.oldestPendingAges) {
				const workflow = workflowLabel(row.workflow);

				oldest.set(
					workflow,
					Math.max(oldest.get(workflow) ?? 0, row.ageSeconds),
				);
			}

			for (const [workflow, ageSeconds] of oldest) {
				oldestPendingJobAge.set({ workflow }, ageSeconds);
			}
		},

		clearJobQueue() {
			// Drop the series rather than leaving them standing. A gauge holds its
			// last value forever, so a refresh that failed would otherwise have
			// every scrape of the outage record a stale backlog as a *fresh*
			// sample — hiding a queue that grew behind a flat line, or holding an
			// alert open for one that drained. An absent series says "unknown",
			// which is the true answer, and `absent()` can alert on it.
			//
			// Zeroing would be worse than either: it asserts an empty queue.
			jobsGauge.reset();
			oldestPendingJobAge.reset();
		},

		contentType: registry.contentType,

		render: () => registry.metrics(),
	};
}
