import type { JobState, StoredJobClaim } from "@virtool/contracts";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
} from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { analyses } from "../db/schema/analyses";
import { indexes } from "../db/schema/indexes";
import { jobs } from "../db/schema/jobs";
import { legacySamples } from "../db/schema/samples";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { collectFrames } from "../test/frames";
import {
	claimJob,
	finishJob,
	getJob,
	getJobs,
	JobNotFoundError,
	JobNotRunningError,
	JobStepAlreadyStartedError,
	JobStepNotFoundError,
	JobTerminalStateError,
	NoJobAvailableError,
	pingJob,
	readJobCounts,
	readOldestPendingJobAges,
	startJobStep,
	timeoutStalledJobs,
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

async function seedJob(
	state: JobState,
	steps: { started: number; of: number },
) {
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
				index_id: 1,
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

// The lifecycle transitions the jobs API serves. Most of their behaviour is
// pinned through the handlers that call them; what is here is the part HTTP
// cannot reach, because a job key stops authenticating the moment its job
// reaches a terminal state and the guard turns the request away first.
describe("the lifecycle transitions", () => {
	const steps = [
		{ id: "first", name: "First", description: "the first step" },
		{ id: "second", name: "Second", description: "the second step" },
	];

	function claim() {
		return claimJob(db, "pathoscope", {
			claim: {
				runner_id: "runner-1",
				mem: 4,
				cpu: 2,
				image: "image",
				runtime_version: "1.0.0",
				workflow_version: "2.0.0",
			},
			steps,
		});
	}

	/** Put a job in the queue and take it, the way a run starts. */
	async function claimFresh() {
		await seedJob("pending", { started: 0, of: 0 });

		return claim();
	}

	it("refuses to claim when nothing is waiting", async () => {
		await expect(claim()).rejects.toBeInstanceOf(NoJobAvailableError);
	});

	// The row is read, one element replaced and the whole array written back,
	// because a JSONB array has no addressable element in SQL. This pins that
	// merge: neither call may write back an array built from the state before
	// the other. It does **not** prove the `FOR UPDATE` — the test fixture opens
	// a single connection, so these two transactions queue rather than race, and
	// the lock is what carries the same guarantee against a real pool.
	it("keeps both steps when they start at the same moment", async () => {
		const claimed = await claimFresh();

		await Promise.all([
			startJobStep(db, claimed.id, "first"),
			startJobStep(db, claimed.id, "second"),
		]);

		const job = await getJob(db, claimed.id);

		expect(job.steps?.every((step) => step.started_at !== null)).toBe(true);
		expect(job.progress).toBe(100);
	});

	// Only reachable as a race: the guard reads the state, and the job is
	// cancelled before the transaction below takes its lock. Rare, and the
	// reason the check is here rather than trusted from the guard's read.
	it("refuses to start a step on a job that has reached a terminal state", async () => {
		const claimed = await claimFresh();

		await db
			.update(jobs)
			.set({ state: "cancelled" })
			.where(eq(jobs.id, claimed.id));

		await expect(startJobStep(db, claimed.id, "first")).rejects.toBeInstanceOf(
			JobTerminalStateError,
		);
	});

	it("refuses to start a step the job does not have", async () => {
		const claimed = await claimFresh();

		await expect(startJobStep(db, claimed.id, "third")).rejects.toBeInstanceOf(
			JobStepNotFoundError,
		);
	});

	it("refuses to start a step twice", async () => {
		const claimed = await claimFresh();

		await startJobStep(db, claimed.id, "first");

		await expect(startJobStep(db, claimed.id, "first")).rejects.toBeInstanceOf(
			JobStepAlreadyStartedError,
		);
	});

	it.each<JobState>(["pending", "cancelled", "failed", "succeeded"])(
		"refuses to finish a job that is %s",
		async (state) => {
			const claimed = await claimFresh();

			await db.update(jobs).set({ state }).where(eq(jobs.id, claimed.id));

			await expect(finishJob(db, claimed.id)).rejects.toBeInstanceOf(
				JobNotRunningError,
			);
		},
	);

	it("reports a ping against a job that no longer exists", async () => {
		const claimed = await claimFresh();

		await db.delete(jobs).where(eq(jobs.id, claimed.id));

		await expect(pingJob(db, claimed.id)).rejects.toBeInstanceOf(
			JobNotFoundError,
		);
	});
});

function byId(a: { id: number }, b: { id: number }) {
	return a.id - b.id;
}

/** Insert a bare job, dated `ageSeconds` in the past. */
async function seedQueuedJob(
	workflow: string,
	state: JobState,
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

const CLAIM: StoredJobClaim = {
	runner_id: "dead-runner",
	mem: 8,
	cpu: 2,
	image: "ghcr.io/virtool/ts-nuvs:0.0.0",
	runtime_version: "1.0.0",
	workflow_version: "0.0.0",
};

/** Insert a job last pinged `pingAgeSeconds` ago, or never when that is null. */
async function seedPingedJob(
	state: JobState,
	pingAgeSeconds: number | null,
): Promise<number> {
	const [job] = await db
		.insert(jobs)
		.values({
			claim: CLAIM,
			claimed_at: new Date(Date.now() - 3600 * 1000),
			created_at: new Date(Date.now() - 3600 * 1000),
			pinged_at:
				pingAgeSeconds === null
					? null
					: new Date(Date.now() - pingAgeSeconds * 1000),
			state,
			user_id: userId,
			workflow: "nuvs",
		})
		.returning({ id: jobs.id });

	if (!job) {
		throw new Error("failed to seed job");
	}

	return job.id;
}

function readJobRow(jobId: number) {
	return db
		.select()
		.from(jobs)
		.where(eq(jobs.id, jobId))
		.then(([row]) => row);
}

describe("timeoutStalledJobs", () => {
	// Both halves in one test, so an off-by-one in the interval arithmetic cannot
	// pass by only ever being asked about one side of the cutoff.
	it("fails a stale running job and leaves a fresh one alone", async () => {
		const stale = await seedPingedJob("running", 600);
		const fresh = await seedPingedJob("running", 60);

		expect(await timeoutStalledJobs(db, { thresholdSeconds: 300 })).toEqual([
			stale,
		]);

		expect(await readJobRow(stale)).toMatchObject({ state: "failed" });
		expect((await readJobRow(stale))?.finished_at).toBeInstanceOf(Date);

		expect(await readJobRow(fresh)).toMatchObject({
			state: "running",
			finished_at: null,
		});
	});

	// `pending` is the one that matters: a queued job is not pinging by
	// definition, and timing it out would fail work nothing has started.
	it("leaves a job that is not running alone however stale", async () => {
		const ids = await Promise.all(
			(["pending", "succeeded", "failed", "cancelled"] as const).map((state) =>
				seedPingedJob(state, 86_400),
			),
		);

		expect(await timeoutStalledJobs(db, { thresholdSeconds: 300 })).toEqual([]);

		for (const id of ids) {
			expect(await readJobRow(id)).toMatchObject({ finished_at: null });
		}
	});

	// `pinged_at < ...` is NULL for a job that has never been pinged, and so
	// falsy. Deliberate, and pinned here so it is not "fixed" into a COALESCE.
	it("never times out a job that has never been pinged", async () => {
		const running = await seedPingedJob("running", null);
		const pending = await seedPingedJob("pending", null);

		expect(await timeoutStalledJobs(db, { thresholdSeconds: 0 })).toEqual([]);

		expect(await readJobRow(running)).toMatchObject({ state: "running" });
		expect(await readJobRow(pending)).toMatchObject({ state: "pending" });
	});

	it("returns an empty array when there is nothing to time out", async () => {
		await expect(timeoutStalledJobs(db)).resolves.toEqual([]);
	});

	// A reclaimed task re-runs its body from step zero, so the second sweep must
	// be a no-op rather than a second write against the same rows.
	it("is idempotent across consecutive sweeps", async () => {
		const stale = await seedPingedJob("running", 600);

		expect(await timeoutStalledJobs(db, { thresholdSeconds: 300 })).toEqual([
			stale,
		]);

		const finishedAt = (await readJobRow(stale))?.finished_at;

		expect(await timeoutStalledJobs(db, { thresholdSeconds: 300 })).toEqual([]);

		expect((await readJobRow(stale))?.finished_at).toEqual(finishedAt);
	});

	// The only way the `timezone('utc', clock_timestamp())` requirement is pinned
	// rather than passing by accident on a UTC box. Under a session `TimeZone` of
	// its own, a cutoff read through that zone is hours off, so the stale row
	// stops matching and the stamp it would have written is wrong by the offset.
	it("works from a UTC clock whatever the session time zone", async () => {
		const stale = await seedPingedJob("running", 600);

		const connection = database.connect();
		onTestFinished(connection.close);

		await connection.db.execute(sql`set time zone 'America/Vancouver'`);

		// Without this the test passes whenever the SET fails to stick, which is
		// the whole of what it is here to rule out.
		expect(await connection.db.execute(sql`show timezone`)).toEqual([
			{ TimeZone: "America/Vancouver" },
		]);

		expect(
			await timeoutStalledJobs(connection.db, { thresholdSeconds: 300 }),
		).toEqual([stale]);

		const finishedAt = (await readJobRow(stale))?.finished_at as Date;

		expect(Math.abs(finishedAt.getTime() - Date.now())).toBeLessThan(60_000);
	});

	// The assertion that stops someone "tidying up" a dead runner's claim. A
	// timed-out job has to stay indistinguishable from any other failure.
	it("leaves claim and claimed_at as the dead runner wrote them", async () => {
		const stale = await seedPingedJob("running", 600);
		const before = await readJobRow(stale);

		await timeoutStalledJobs(db, { thresholdSeconds: 300 });

		expect(await readJobRow(stale)).toMatchObject({
			claim: CLAIM,
			claimed_at: before?.claimed_at,
			state: "failed",
		});
	});

	// A sweep failing several jobs at once publishes one frame each. The client
	// coalesces the burst into a batched read; nothing throttles it here.
	it("publishes one jobs frame per timed-out id", async () => {
		const first = await seedPingedJob("running", 600);
		const second = await seedPingedJob("running", 600);
		const third = await seedPingedJob("running", 600);
		await seedPingedJob("running", 60);

		const frames = await collectFrames(database.client, async () => {
			await timeoutStalledJobs(db, { thresholdSeconds: 300 });
		});

		expect(
			frames.sort(
				(a, b) => (a.resource_id as number) - (b.resource_id as number),
			),
		).toEqual([
			{ domain: "jobs", resource_id: first, operation: "update" },
			{ domain: "jobs", resource_id: second, operation: "update" },
			{ domain: "jobs", resource_id: third, operation: "update" },
		]);
	});

	it("publishes nothing when the sweep matches no job", async () => {
		await seedPingedJob("running", 60);

		const frames = await collectFrames(database.client, async () => {
			await timeoutStalledJobs(db, { thresholdSeconds: 300 });
		});

		expect(frames).toEqual([]);
	});
});
