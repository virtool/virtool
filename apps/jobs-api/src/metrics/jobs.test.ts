import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import type { JobQueueSnapshot } from "@virtool/data/jobs/data";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createJobQueueReader } from "./jobs";
import { createMetrics } from "./registry";

let database: TestDatabase;
let db: Db;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db, { handle: "bob" });
});

async function seedQueuedJob(
	workflow: string,
	state: string,
	ageSeconds = 0,
): Promise<void> {
	await db.insert(jobs).values({
		created_at: new Date(Date.now() - ageSeconds * 1000),
		state,
		user_id: userId,
		workflow,
	});
}

/**
 * The value of one rendered sample, or undefined when the series is absent.
 *
 * Matches on the label pairs rather than on a whole rendered line, so a change
 * in the order prom-client emits labels does not silently turn every assertion
 * below into `undefined === undefined`.
 */
function sample(
	rendered: string,
	name: string,
	labels: Record<string, string>,
): string | undefined {
	const line = rendered.split("\n").find((candidate) => {
		if (!candidate.startsWith(`${name}{`)) {
			return false;
		}

		return Object.entries(labels).every(([key, value]) =>
			candidate.includes(`${key}="${value}"`),
		);
	});

	return line?.split("}").pop()?.trim();
}

describe("createJobQueueReader", () => {
	it("reads counts and ages together", async () => {
		await seedQueuedJob("pathoscope", "pending", 300);
		await seedQueuedJob("pathoscope", "running");

		const snapshot = await createJobQueueReader(db)();

		expect(
			[...snapshot.counts].sort((a, b) => a.state.localeCompare(b.state)),
		).toEqual([
			{ workflow: "pathoscope", state: "pending", count: 1 },
			{ workflow: "pathoscope", state: "running", count: 1 },
		]);

		expect(snapshot.oldestPendingAges).toHaveLength(1);
		expect(snapshot.oldestPendingAges[0]?.ageSeconds).toBeGreaterThanOrEqual(
			300,
		);
	});

	// Two Prometheus replicas, or a human curling in a loop, would otherwise
	// multiply an unindexed scan across the pool the jobs API serves
	// workflows from.
	it("does not re-query inside its TTL", async () => {
		await seedQueuedJob("nuvs", "pending");

		let clock = 0;
		const read = createJobQueueReader(db, { ttlMs: 10_000, now: () => clock });

		expect(await read()).toEqual(await read());

		await seedQueuedJob("nuvs", "pending");
		clock = 9_999;

		expect((await read()).counts).toEqual([
			{ workflow: "nuvs", state: "pending", count: 1 },
		]);

		clock = 10_000;

		expect((await read()).counts).toEqual([
			{ workflow: "nuvs", state: "pending", count: 2 },
		]);
	});

	// A cache keyed only on the last settled result would let two scrapes
	// arriving together each open their own query.
	it("shares an in-flight read between concurrent callers", async () => {
		await seedQueuedJob("nuvs", "pending");

		const read = createJobQueueReader(db);
		const [first, second] = await Promise.all([read(), read()]);

		expect(first).toBe(second);
	});

	// Holding a failure for the full TTL would keep these series dark for ten
	// seconds past a blip that lasted one.
	it("does not cache a failed read", async () => {
		const broken = new Proxy(
			{},
			{
				get() {
					throw new Error("postgres is down");
				},
			},
		) as Db;

		const read = createJobQueueReader(broken);

		await expect(read()).rejects.toThrow("postgres is down");
		await expect(read()).rejects.toThrow("postgres is down");
	});
});

describe("setJobQueue", () => {
	function render(snapshot: JobQueueSnapshot): Promise<string> {
		const metrics = createMetrics(10);
		metrics.setJobQueue(snapshot);

		return metrics.render();
	}

	it("renders both series with their labels", async () => {
		const rendered = await render({
			counts: [{ workflow: "nuvs", state: "pending", count: 3 }],
			oldestPendingAges: [{ workflow: "nuvs", ageSeconds: 412 }],
		});

		expect(
			sample(rendered, "virtool_jobs", { workflow: "nuvs", state: "pending" }),
		).toBe("3");
		expect(
			sample(rendered, "virtool_jobs_oldest_pending_age_seconds", {
				workflow: "nuvs",
			}),
		).toBe("412");
	});

	// A gauge holds its last value forever, so a drained workflow would otherwise
	// report its final backlog indefinitely — the worst possible failure for an
	// alert on queue depth.
	it("writes zero for a workflow that drained", async () => {
		const metrics = createMetrics(10);

		metrics.setJobQueue({
			counts: [{ workflow: "nuvs", state: "pending", count: 3 }],
			oldestPendingAges: [{ workflow: "nuvs", ageSeconds: 412 }],
		});

		metrics.setJobQueue({ counts: [], oldestPendingAges: [] });

		const rendered = await metrics.render();

		expect(
			sample(rendered, "virtool_jobs", { workflow: "nuvs", state: "pending" }),
		).toBe("0");
		expect(
			sample(rendered, "virtool_jobs_oldest_pending_age_seconds", {
				workflow: "nuvs",
			}),
		).toBe("0");
	});

	it("writes the whole workflow and state cross product", async () => {
		const rendered = await render({ counts: [], oldestPendingAges: [] });

		for (const workflow of [
			"build_index",
			"create_sample",
			"create_subtraction",
			"nuvs",
			"pathoscope",
			"other",
		]) {
			for (const state of ["pending", "running"]) {
				expect(sample(rendered, "virtool_jobs", { workflow, state })).toBe("0");
			}
		}
	});

	// `jobs.workflow` is a plain text column with no enum constraint, so bounded
	// cardinality is only true if this side makes it so.
	it("folds an unrecognised workflow into other and mints no series", async () => {
		const rendered = await render({
			counts: [
				{ workflow: "typo_workflow", state: "pending", count: 2 },
				{ workflow: "a_future_python_workflow", state: "pending", count: 5 },
			],
			oldestPendingAges: [
				{ workflow: "typo_workflow", ageSeconds: 30 },
				{ workflow: "a_future_python_workflow", ageSeconds: 900 },
			],
		});

		expect(rendered).not.toContain("typo_workflow");
		expect(rendered).not.toContain("a_future_python_workflow");

		// Two workflows on one label: counts add, ages take the oldest.
		expect(
			sample(rendered, "virtool_jobs", { workflow: "other", state: "pending" }),
		).toBe("7");
		expect(
			sample(rendered, "virtool_jobs_oldest_pending_age_seconds", {
				workflow: "other",
			}),
		).toBe("900");
	});

	// Re-serving the last known depth on every scrape of an outage would have
	// Prometheus record it as fresh, hiding a queue that grew behind a flat line
	// or holding an alert open for one that drained. An absent series says
	// "unknown", which is the true answer.
	it("drops the series entirely when a refresh fails", async () => {
		const metrics = createMetrics(10);

		metrics.setJobQueue({
			counts: [{ workflow: "nuvs", state: "pending", count: 47 }],
			oldestPendingAges: [{ workflow: "nuvs", ageSeconds: 900 }],
		});

		metrics.clearJobQueue();

		const rendered = await metrics.render();

		// Absent, not zeroed — zero asserts an empty queue, which is a different
		// claim from not knowing. `sample` returns undefined either way only if
		// the line is gone entirely, which the raw checks below pin.
		expect(rendered).not.toContain("virtool_jobs{");
		expect(rendered).not.toContain("virtool_jobs_oldest_pending_age_seconds{");
		expect(
			sample(rendered, "virtool_jobs", { workflow: "nuvs", state: "pending" }),
		).toBeUndefined();

		// The rest of the exposition is untouched.
		expect(rendered).toContain("virtool_postgres_pool_max 10");
	});

	// The query restricts the state already; the guard keeps the label bounded
	// here rather than at a distance.
	it("ignores a state outside the non-terminal set", async () => {
		const rendered = await render({
			counts: [{ workflow: "nuvs", state: "succeeded", count: 9 }],
			oldestPendingAges: [],
		});

		expect(rendered).not.toContain('state="succeeded"');
	});
});
