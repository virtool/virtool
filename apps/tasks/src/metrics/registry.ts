import { PeriodicTaskName, TaskName } from "@virtool/contracts";
import type { TaskQueueSnapshot } from "@virtool/data/tasks/data";
import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";

/**
 * The label an unrecognised `tasks.type` value is folded into.
 *
 * `type` is a plain `text` column with no constraint on either side, so
 * "bounded by the union" is only true if this side makes it so. A typo, or a
 * task a future Python release adds, must not mint a series that never retires.
 */
const OTHER_TASK = "other";

/**
 * The task names that keep their own label.
 *
 * A row whose type really is the string `other` is an unrecognised task, not a
 * recognised one, so the set is {@link TaskName} rather than the wider list of
 * labels this process may emit.
 */
const KNOWN_TASKS = new Set<string>(TaskName.options);

/** Every task label this process will ever emit. */
const TASK_LABELS = [...TaskName.options, OTHER_TASK];

/** The two halves Python's `get_counts` splits the active queue into. */
const QUEUE_STATES = ["queued", "running"] as const;

/** How a spawn attempt for a periodic task ended. */
export type SpawnOutcome = "spawned" | "skipped_locked" | "not_due";

/** Every spawn outcome, for pre-declaring the counter's label set. */
const SPAWN_OUTCOMES: SpawnOutcome[] = ["spawned", "skipped_locked", "not_due"];

/** How a claimed task ended. */
export type RunOutcome = "succeeded" | "failed";

/**
 * Bucket boundaries for task duration, in seconds: 1 s to 2 h.
 *
 * Deliberately **not** the `virtool_http_*` buckets, which top out at 10 s.
 * Reference imports and index builds run for minutes, so request-sized buckets
 * would put nearly every task in `+Inf` and leave the histogram unable to
 * express any quantile at all. The low end still resolves a sweep that finds
 * nothing, which is the common case for the 30-second BLAST sweep.
 */
const TASK_DURATION_BUCKETS = [
	1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200,
];

/** One finished task run, as the claim loop observed it. */
export type TaskRunSample = {
	/**
	 * The claimed row's `type`, verbatim.
	 *
	 * Typed `string` rather than `TaskName` because it comes off an
	 * unconstrained column; it is folded onto a bounded label here.
	 */
	type: string;
	outcome: RunOutcome;
	durationSeconds: number;
};

/** The metrics surface this process exposes, as returned by {@link createMetrics}. */
export type Metrics = {
	recordSpawn: (type: PeriodicTaskName, outcome: SpawnOutcome) => void;
	recordRun: (sample: TaskRunSample) => void;
	setTaskQueue: (snapshot: TaskQueueSnapshot) => void;
	clearTaskQueue: () => void;
	contentType: string;
	render: () => Promise<string>;
};

function taskLabel(type: string): string {
	return KNOWN_TASKS.has(type) ? type : OTHER_TASK;
}

/**
 * Build this process's Prometheus registry and the handles that write to it.
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
 * The `virtool_http_*` series are deliberately absent: they are web-specific,
 * their buckets top out at 10 s, and this process serves nothing but probes.
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

	const spawns = new Counter({
		name: "virtool_task_spawn_total",
		help: "Periodic task spawn attempts, by task type and outcome.",
		labelNames: ["type", "outcome"],
		registers: [registry],
	});

	// Pre-declared over the whole cross product, because a counter's children do
	// not exist until one is incremented and an absent series cannot be told from
	// a zero one. Two readings depend on the difference: `rate()` needs a prior
	// sample to subtract, so an unseeded counter reports nothing until its
	// *second* increment; and `skipped_locked` staying at zero — the spawner
	// never losing the advisory lock — has to be visible as zero rather than as
	// a missing series, since that is the evidence the lock is shared with
	// Python's spawner rather than being taken uncontested.
	//
	// The cross product is bounded and known here in a way the run counter's is
	// not: the spawn schedule is fixed at build time, while which types a runner
	// claims is configuration this registry never sees.
	for (const type of PeriodicTaskName.options) {
		for (const outcome of SPAWN_OUTCOMES) {
			spawns.inc({ type, outcome }, 0);
		}
	}

	const runs = new Counter({
		name: "virtool_task_runs_total",
		help: "Tasks run to completion by this process, by task type and outcome.",
		labelNames: ["type", "outcome"],
		registers: [registry],
	});

	// `outcome` is deliberately absent here. Duration buckets are a property of
	// the work, not of how it ended, and splitting them would halve the samples
	// behind every quantile to express a dimension the counter above already
	// carries.
	const runDuration = new Histogram({
		name: "virtool_task_duration_seconds",
		help: "Time from claim to terminal write for a task run, in seconds.",
		labelNames: ["type"],
		buckets: TASK_DURATION_BUCKETS,
		registers: [registry],
	});

	// The queue dimension, reported by the spawner half alone — every replica
	// carries a runner, and N replicas each running this scan against the same
	// table buys nothing but load. Both labels are bounded by construction.
	const tasksGauge = new Gauge({
		name: "virtool_tasks",
		help: "Active tasks, by type and queue state.",
		labelNames: ["type", "state"],
		registers: [registry],
	});

	const oldestQueuedTaskAge = new Gauge({
		name: "virtool_tasks_oldest_queued_age_seconds",
		help: "Age of the oldest task still waiting for a runner, by type.",
		labelNames: ["type"],
		registers: [registry],
	});

	return {
		recordSpawn(type, outcome) {
			// No fold: the caller's type is the schedule, which this union is.
			spawns.inc({ type, outcome });
		},

		recordRun(sample) {
			const type = taskLabel(sample.type);

			runs.inc({ type, outcome: sample.outcome });
			runDuration.observe({ type }, sample.durationSeconds);
		},

		setTaskQueue(snapshot) {
			// Write the whole cross product as zero first. A gauge holds its last
			// value forever, so a type that drains would otherwise report its final
			// backlog indefinitely — the worst possible failure for an alert on
			// queue depth.
			for (const type of TASK_LABELS) {
				oldestQueuedTaskAge.set({ type }, 0);

				for (const state of QUEUE_STATES) {
					tasksGauge.set({ type, state }, 0);
				}
			}

			// Folding several types onto `other` puts several rows on one label, so
			// counts add rather than overwrite.
			for (const row of snapshot.counts) {
				const type = taskLabel(row.type);

				tasksGauge.inc({ type, state: "queued" }, row.queued);
				tasksGauge.inc({ type, state: "running" }, row.running);
			}

			// An age does not add, so a folded label takes the oldest of what falls
			// into it — which is what "the oldest queued task" means for every other
			// label too.
			const oldest = new Map<string, number>();

			for (const row of snapshot.oldestQueuedAges) {
				const type = taskLabel(row.type);

				oldest.set(type, Math.max(oldest.get(type) ?? 0, row.ageSeconds));
			}

			for (const [type, ageSeconds] of oldest) {
				oldestQueuedTaskAge.set({ type }, ageSeconds);
			}
		},

		clearTaskQueue() {
			// Drop the series rather than leaving them standing. A gauge holds its
			// last value forever, so a refresh that failed would otherwise have every
			// scrape of the outage record a stale backlog as a *fresh* sample —
			// hiding a queue that grew behind a flat line, or holding an alert open
			// for one that drained. An absent series says "unknown", which is the
			// true answer, and `absent()` can alert on it.
			//
			// Zeroing would be worse than either: it asserts an empty queue.
			tasksGauge.reset();
			oldestQueuedTaskAge.reset();
		},

		contentType: registry.contentType,

		render: () => registry.metrics(),
	};
}
