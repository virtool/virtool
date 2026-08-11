import { PeriodicTaskName, TaskName } from "@virtool/contracts";
import type { TaskQueueSnapshot } from "@virtool/data/tasks/data";
import { describe, expect, it } from "vitest";
import { createMetrics, type Metrics } from "./registry";

const VERSION = "1.2.3";

function build(): Metrics {
	return createMetrics(VERSION);
}

/** Every sample line for `name`, in render order. */
async function lines(metrics: Metrics, name: string): Promise<string[]> {
	return (await metrics.render())
		.split("\n")
		.filter((line) => line.startsWith(name) && !line.startsWith(`${name}_`));
}

/** The value of the one sample matching `selector`, or `undefined`. */
async function sample(
	metrics: Metrics,
	selector: string,
): Promise<number | undefined> {
	const line = (await metrics.render())
		.split("\n")
		.find((candidate) => candidate.startsWith(selector));

	return line ? Number(line.slice(line.lastIndexOf(" ") + 1)) : undefined;
}

const EMPTY_QUEUE: TaskQueueSnapshot = { counts: [], oldestQueuedAges: [] };

describe("createMetrics", () => {
	it("gives each caller its own registry", async () => {
		const first = build();
		const second = build();

		first.recordRun({
			type: "install_hmms",
			outcome: "succeeded",
			durationSeconds: 1,
		});

		expect(await lines(second, "virtool_task_runs_total")).toEqual([]);
	});

	it("registers the default process metrics unprefixed", async () => {
		const rendered = await build().render();

		expect(rendered).toContain("process_cpu_seconds_total");
		expect(rendered).toContain("nodejs_eventloop_lag_seconds");
	});

	it("pins virtool_app_info at 1 with the version", async () => {
		expect(
			await sample(build(), `virtool_app_info{version="${VERSION}"}`),
		).toBe(1);
	});

	it("registers no virtool_http_ series", async () => {
		expect(await build().render()).not.toContain("virtool_http_");
	});
});

describe("recordSpawn", () => {
	it("pre-declares every schedule and outcome at zero", async () => {
		const metrics = build();

		expect(await lines(metrics, "virtool_task_spawn_total")).toHaveLength(
			PeriodicTaskName.options.length * 3,
		);

		// The evidence VIR-2888 gates on is `skipped_locked` being *visible*, so
		// that "the lock was never contended" can be told from "the counter was
		// never wired up".
		expect(
			await sample(
				metrics,
				'virtool_task_spawn_total{type="sweep_blast",outcome="skipped_locked"}',
			),
		).toBe(0);
	});

	it("counts an outcome against its task type", async () => {
		const metrics = build();

		metrics.recordSpawn("refresh_hmms", "spawned");
		metrics.recordSpawn("refresh_hmms", "not_due");
		metrics.recordSpawn("refresh_hmms", "not_due");

		expect(
			await sample(
				metrics,
				'virtool_task_spawn_total{type="refresh_hmms",outcome="spawned"}',
			),
		).toBe(1);
		expect(
			await sample(
				metrics,
				'virtool_task_spawn_total{type="refresh_hmms",outcome="not_due"}',
			),
		).toBe(2);
	});
});

describe("recordRun", () => {
	it("counts the outcome and observes the duration", async () => {
		const metrics = build();

		metrics.recordRun({
			type: "create_index",
			outcome: "failed",
			durationSeconds: 42,
		});

		expect(
			await sample(
				metrics,
				'virtool_task_runs_total{type="create_index",outcome="failed"}',
			),
		).toBe(1);
		expect(
			await sample(
				metrics,
				'virtool_task_duration_seconds_count{type="create_index"}',
			),
		).toBe(1);
		expect(
			await sample(
				metrics,
				'virtool_task_duration_seconds_sum{type="create_index"}',
			),
		).toBe(42);
	});

	it("does not split the histogram by outcome", async () => {
		const metrics = build();

		metrics.recordRun({
			type: "create_index",
			outcome: "failed",
			durationSeconds: 1,
		});

		expect(await build().render()).not.toContain(
			"virtool_task_duration_seconds_bucket{outcome",
		);
		expect(
			await sample(
				metrics,
				'virtool_task_duration_seconds_count{type="create_index"}',
			),
		).toBe(1);
	});

	// Request-sized buckets top out at 10 s, which would put a reference import
	// and a two-hour index build in the same `+Inf` bucket and leave the
	// histogram unable to express any quantile above the median.
	it("has buckets a long task can land in", async () => {
		const metrics = build();

		metrics.recordRun({
			type: "import_reference",
			outcome: "succeeded",
			durationSeconds: 900,
		});

		expect(
			await sample(
				metrics,
				'virtool_task_duration_seconds_bucket{le="600",type="import_reference"}',
			),
		).toBe(0);
		expect(
			await sample(
				metrics,
				'virtool_task_duration_seconds_bucket{le="1800",type="import_reference"}',
			),
		).toBe(1);
	});

	it("folds a type the union does not name onto other", async () => {
		const metrics = build();

		metrics.recordRun({
			type: "a_python_task",
			outcome: "succeeded",
			durationSeconds: 1,
		});

		expect(
			await sample(
				metrics,
				'virtool_task_runs_total{type="other",outcome="succeeded"}',
			),
		).toBe(1);
		expect(await metrics.render()).not.toContain("a_python_task");
	});
});

describe("setTaskQueue", () => {
	it("reports queued and running separately", async () => {
		const metrics = build();

		metrics.setTaskQueue({
			counts: [{ type: "install_hmms", queued: 3, running: 1 }],
			oldestQueuedAges: [{ type: "install_hmms", ageSeconds: 90 }],
		});

		expect(
			await sample(
				metrics,
				'virtool_tasks{type="install_hmms",state="queued"}',
			),
		).toBe(3);
		expect(
			await sample(
				metrics,
				'virtool_tasks{type="install_hmms",state="running"}',
			),
		).toBe(1);
		expect(
			await sample(
				metrics,
				'virtool_tasks_oldest_queued_age_seconds{type="install_hmms"}',
			),
		).toBe(90);
	});

	it("writes the whole cross product, so a drained queue reports zero", async () => {
		const metrics = build();

		metrics.setTaskQueue({
			counts: [{ type: "install_hmms", queued: 3, running: 0 }],
			oldestQueuedAges: [{ type: "install_hmms", ageSeconds: 90 }],
		});

		metrics.setTaskQueue(EMPTY_QUEUE);

		expect(
			await sample(
				metrics,
				'virtool_tasks{type="install_hmms",state="queued"}',
			),
		).toBe(0);
		expect(
			await sample(
				metrics,
				'virtool_tasks_oldest_queued_age_seconds{type="install_hmms"}',
			),
		).toBe(0);
		expect(await lines(metrics, "virtool_tasks{")).toHaveLength(
			(TaskName.options.length + 1) * 2,
		);
	});

	it("adds counts folded onto other rather than overwriting", async () => {
		const metrics = build();

		metrics.setTaskQueue({
			counts: [
				{ type: "a_python_task", queued: 2, running: 1 },
				{ type: "another_python_task", queued: 3, running: 0 },
			],
			oldestQueuedAges: [],
		});

		expect(
			await sample(metrics, 'virtool_tasks{type="other",state="queued"}'),
		).toBe(5);
		expect(
			await sample(metrics, 'virtool_tasks{type="other",state="running"}'),
		).toBe(1);
	});

	it("takes the oldest age of what folds onto other", async () => {
		const metrics = build();

		metrics.setTaskQueue({
			counts: [],
			oldestQueuedAges: [
				{ type: "a_python_task", ageSeconds: 30 },
				{ type: "another_python_task", ageSeconds: 900 },
			],
		});

		expect(
			await sample(
				metrics,
				'virtool_tasks_oldest_queued_age_seconds{type="other"}',
			),
		).toBe(900);
	});
});

describe("clearTaskQueue", () => {
	// Dropped rather than zeroed: an absent series says "unknown", which is true
	// during a Postgres outage. Zero would assert an empty queue.
	it("drops the queue series without touching the rest", async () => {
		const metrics = build();

		metrics.setTaskQueue({
			counts: [{ type: "install_hmms", queued: 3, running: 1 }],
			oldestQueuedAges: [{ type: "install_hmms", ageSeconds: 90 }],
		});
		metrics.recordRun({
			type: "install_hmms",
			outcome: "succeeded",
			durationSeconds: 1,
		});

		metrics.clearTaskQueue();

		expect(await lines(metrics, "virtool_tasks{")).toEqual([]);
		expect(
			await lines(metrics, "virtool_tasks_oldest_queued_age_seconds{"),
		).toEqual([]);
		expect(await lines(metrics, "virtool_task_runs_total")).toHaveLength(1);
	});
});
