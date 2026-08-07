import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { analyses } from "../db/schema/analyses";
import { indexes } from "../db/schema/indexes";
import { jobs } from "../db/schema/jobs";
import { legacySamples } from "../db/schema/samples";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	getJob,
	getJobs,
	JobNotFoundError,
	readJobCounts,
	readOldestPendingJobAges,
} from "./data";

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

async function seedJob(state: string, steps: { started: number; of: number }) {
	const [job] = await db
		.insert(jobs)
		.values({
			created_at: new Date(),
			state,
			steps: Array.from({ length: steps.of }, (_, index) => ({
				description: `step ${index}`,
				id: `step-${index}`,
				name: `step-${index}`,
				started_at: index < steps.started ? new Date().toISOString() : null,
			})),
			user_id: userId,
			workflow: "pathoscope",
		})
		.returning({ id: jobs.id });

	if (!job) {
		throw new Error("failed to seed job");
	}

	return job.id;
}

describe("getJobs", () => {
	it("reads every requested job in one call", async () => {
		const first = await seedJob("running", { started: 1, of: 4 });
		const second = await seedJob("running", { started: 3, of: 4 });

		const result = await getJobs(db, [first, second]);

		expect(
			result.map(({ id, progress }) => ({ id, progress })).sort(byId),
		).toEqual([
			{ id: first, progress: 25 },
			{ id: second, progress: 75 },
		]);
	});

	// A batch is best-effort: one job deleted between the frame and the read
	// must not cost the caller the rest of the wave.
	it("omits ids that match no job rather than failing the batch", async () => {
		const jobId = await seedJob("running", { started: 2, of: 4 });

		const result = await getJobs(db, [jobId, jobId + 5000]);

		expect(result.map(({ id }) => id)).toEqual([jobId]);
	});

	it("returns nothing for an empty id list without touching the database", async () => {
		await expect(getJobs(db, [])).resolves.toEqual([]);
	});
});

describe("getJob", () => {
	it("returns the job", async () => {
		const jobId = await seedJob("succeeded", { started: 0, of: 2 });

		await expect(getJob(db, jobId)).resolves.toMatchObject({
			id: jobId,
			progress: 100,
			state: "succeeded",
			user: { id: userId, handle: "bob" },
			workflow: "pathoscope",
		});
	});

	it("throws JobNotFoundError when the job is absent", async () => {
		await expect(getJob(db, 404_404)).rejects.toThrow(JobNotFoundError);
	});

	// A job that ran an analysis exposes the analysis's integer id as its
	// `analysis_id` arg, so the client links to `/analyses/<id>`. The id is
	// stringified because `args` is a string map.
	it("exposes a linked analysis's integer id as a string arg", async () => {
		const jobId = await seedJob("succeeded", { started: 0, of: 1 });

		const now = new Date();
		const [analysis] = await db
			.insert(analyses)
			.values({
				created_at: now,
				updated_at: now,
				sample: "0",
				user_id: 1,
				job_id: jobId,
				workflow: "nuvs",
				ready: false,
			})
			.returning({ id: analyses.id });
		if (!analysis) {
			throw new Error("failed to seed analysis");
		}

		const job = await getJob(db, jobId);

		expect(job.args.analysis_id).toBe(String(analysis.id));
	});

	// A create_sample job's sample is resolved through the reverse
	// `legacy_samples.job_id` foreign key — there is no `job_samples` link table
	// — and its integer id is exposed as the `sample_id` arg.
	it("exposes a linked sample's id as a string arg", async () => {
		const jobId = await seedJob("succeeded", { started: 0, of: 1 });

		const [sample] = await db
			.insert(legacySamples)
			.values({
				job_id: jobId,
				name: "Sample A",
				library_type: "normal",
				created_at: new Date(),
			})
			.returning({ id: legacySamples.id });
		if (!sample) {
			throw new Error("failed to seed sample");
		}

		const job = await getJob(db, jobId);

		expect(job.args.sample_id).toBe(String(sample.id));
	});

	// A build_index job's index is resolved through the reverse `indexes.job_id`
	// foreign key — there is no `job_indexes` link table — and its integer id is
	// exposed as the `index_id` arg.
	it("exposes a linked index's id as a string arg", async () => {
		const jobId = await seedJob("succeeded", { started: 0, of: 1 });

		const [index] = await db
			.insert(indexes)
			.values({
				created_at: new Date(),
				job_id: jobId,
				manifest: {},
				reference_id: 1,
				storage_key: "job-linked-index",
				user_id: 1,
				version: 0,
			})
			.returning({ id: indexes.id });
		if (!index) {
			throw new Error("failed to seed index");
		}

		const job = await getJob(db, jobId);

		expect(job.args.index_id).toBe(String(index.id));
	});
});

function byId(a: { id: number }, b: { id: number }) {
	return a.id - b.id;
}

/** Insert a bare job, dated `ageSeconds` in the past. */
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

function bySeries(
	a: { workflow: string; state?: string },
	b: { workflow: string; state?: string },
) {
	return (
		a.workflow.localeCompare(b.workflow) ||
		(a.state ?? "").localeCompare(b.state ?? "")
	);
}

describe("readJobCounts", () => {
	it("groups by workflow and state", async () => {
		await seedQueuedJob("pathoscope", "pending");
		await seedQueuedJob("pathoscope", "pending");
		await seedQueuedJob("pathoscope", "running");
		await seedQueuedJob("nuvs", "running");

		expect((await readJobCounts(db)).sort(bySeries)).toEqual([
			{ workflow: "nuvs", state: "running", count: 1 },
			{ workflow: "pathoscope", state: "pending", count: 2 },
			{ workflow: "pathoscope", state: "running", count: 1 },
		]);
	});

	// Counting every job ever run is a scan that grows forever against a table
	// this side cannot index, and a gauge over accumulated history is a counter
	// wearing the wrong hat.
	it("excludes terminal states", async () => {
		await seedQueuedJob("nuvs", "succeeded");
		await seedQueuedJob("nuvs", "failed");
		await seedQueuedJob("nuvs", "cancelled");
		await seedQueuedJob("nuvs", "pending");

		expect(await readJobCounts(db)).toEqual([
			{ workflow: "nuvs", state: "pending", count: 1 },
		]);
	});

	it("reports nothing for an empty queue", async () => {
		expect(await readJobCounts(db)).toEqual([]);
	});
});

describe("readOldestPendingJobAges", () => {
	it("reports the oldest pending job per workflow", async () => {
		await seedQueuedJob("nuvs", "pending", 600);
		await seedQueuedJob("nuvs", "pending", 60);
		await seedQueuedJob("pathoscope", "pending", 120);

		const ages = (await readOldestPendingJobAges(db)).sort(bySeries);

		expect(ages.map((age) => age.workflow)).toEqual(["nuvs", "pathoscope"]);
		expect(ages[0]?.ageSeconds).toBeGreaterThanOrEqual(600);
		expect(ages[0]?.ageSeconds).toBeLessThan(660);
		expect(ages[1]?.ageSeconds).toBeGreaterThanOrEqual(120);
		expect(ages[1]?.ageSeconds).toBeLessThan(180);
	});

	// A running job is no longer waiting, so it says nothing about queue latency.
	it("ignores jobs that are not pending", async () => {
		await seedQueuedJob("nuvs", "running", 3600);
		await seedQueuedJob("nuvs", "succeeded", 7200);
		await seedQueuedJob("nuvs", "pending", 30);

		const ages = await readOldestPendingJobAges(db);

		expect(ages).toHaveLength(1);
		expect(ages[0]?.ageSeconds).toBeLessThan(90);
	});
});
