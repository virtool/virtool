import type { JobState } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { subtractions } from "@virtool/data/db/schema/subtractions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { emit } from "@virtool/data/events/emit";
import { createLogger } from "@virtool/logger";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { createApp } from "../app";
import { type SeededJob, seedJob } from "../auth/test/fixtures";
import { createMetrics } from "../metrics/registry";
import {
	handleClaimJob,
	handleFinishJob,
	handlePingJob,
	handleReadJob,
	handleStartJobStep,
	type JobHandlerDeps,
} from "./handlers";

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
}));

let database: TestDatabase;
let db: Db;
let deps: JobHandlerDeps;
let userId: number;

const logger = createLogger({ name: "test", level: "silent" });

const STEPS = [
	{
		id: "prepare_reads",
		name: "Prepare reads",
		description: "Trim and collapse the sample's reads",
	},
	{
		id: "map_default_isolates",
		name: "Map default isolates",
		description: "Map the reads against every default isolate",
	},
];

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	deps = { db, logger };
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.mocked(emit).mockClear();

	await db.delete(subtractions);
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db, { handle: "bob" });
});

/** The runner metadata and step list a claim carries, all camelCase. */
function claimBody() {
	return {
		runnerId: "runner-1",
		mem: 4,
		cpu: 2,
		image: "ghcr.io/virtool/ts-pathoscope:1.0.0",
		runtimeVersion: "1.2.3",
		workflowVersion: "4.5.6",
		steps: STEPS,
	};
}

function claimRequest(workflow: string | null, body: unknown = claimBody()) {
	const url = new URL("https://jobs.virtool.test/jobs/claim");

	if (workflow !== null) {
		url.searchParams.set("workflow", workflow);
	}

	return new Request(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

/** A request carrying `job`'s credential, for whatever path is being exercised. */
function authorized(job: SeededJob, path: string, method = "GET"): Request {
	return new Request(`https://jobs.virtool.test${path}`, {
		method,
		headers: {
			authorization: `Basic ${Buffer.from(`job-${job.id}:${job.key}`).toString("base64")}`,
		},
	});
}

/** A job waiting to be claimed: pending, unacquired and keyless. */
function seedPending(options: { workflow?: string; createdAt?: Date } = {}) {
	return seedJob(db, userId, {
		state: "pending",
		withKey: false,
		workflow: "pathoscope",
		...options,
	});
}

/** A job mid-run, with a step list a runner can start steps against. */
function seedRunning(options: { state?: JobState } = {}) {
	return seedJob(db, userId, {
		steps: STEPS.map((step) => ({ ...step, started_at: null })),
		workflow: "pathoscope",
		...options,
	});
}

/**
 * The whole app over the test database.
 *
 * A row that does not fit the wire contract is a thrown error rather than a
 * returned refusal, so what it becomes — a JSON 500 and a Sentry event — is only
 * visible through `app.onError`.
 */
function appWith(captureException: (err: unknown) => void) {
	return createApp({
		client: database.client,
		db,
		storage: new MemoryStorage(),
		logger,
		metrics: createMetrics(10),
		applicationName: "virtool-ts-jobs-api@test",
		metricsToken: undefined,
		isReady: () => true,
		captureException,
	});
}

describe("handleClaimJob", () => {
	it("hands out a job and the key that authenticates as it", async () => {
		const pending = await seedPending();

		const response = await handleClaimJob(deps, claimRequest("pathoscope"));

		expect(response.status).toBe(200);

		const body = await response.json();

		expect(body.id).toBe(pending.id);
		expect(body.acquired).toBe(true);
		expect(body.state).toBe("running");

		// The key is returned in plaintext exactly once, and it has to work. A
		// claim that answered with a key the guard then refuses would strand the
		// pod holding it.
		const read = await handleReadJob(
			deps,
			authorized({ id: body.id, key: body.key }, `/jobs/${body.id}`),
			String(body.id),
		);

		expect(read.status).toBe(200);
	});

	// The handler hands `Response.json` the `Date` it read out of Postgres
	// rather than encoding one itself, and JSON has no date type, so what
	// crosses is still the ISO string Python's serialiser produces. This is the
	// half a type change is free to break silently.
	it("encodes its timestamps as ISO strings on the wire", async () => {
		const pending = await seedPending();

		const body = await (
			await handleClaimJob(deps, claimRequest("pathoscope"))
		).json();

		const [row] = await db
			.select({ created_at: jobs.created_at, claimed_at: jobs.claimed_at })
			.from(jobs)
			.where(eq(jobs.id, pending.id));

		expect(body.createdAt).toBe(row?.created_at?.toISOString());
		expect(body.claimedAt).toBe(row?.claimed_at?.toISOString());
	});

	// Only the digest is stored. A column holding the plaintext would let anyone
	// who can read the table act as every running job.
	it("stores only the key's digest", async () => {
		await seedPending();

		const body = await (
			await handleClaimJob(deps, claimRequest("pathoscope"))
		).json();

		const [row] = await db
			.select({ key: jobs.key })
			.from(jobs)
			.where(eq(jobs.id, body.id));

		expect(row?.key).not.toBe(body.key);
		expect(row?.key).toHaveLength(64);
	});

	// Every field crossing this wire is camelCase, and the JSONB column it is
	// written to is snake_case. Returning the stored blob straight out of the
	// column is the way that rule breaks in practice, so both halves are pinned.
	it("speaks camelCase on the wire and snake_case in the column", async () => {
		await seedPending();

		const body = await (
			await handleClaimJob(deps, claimRequest("pathoscope"))
		).json();

		expect(body.claim).toEqual({
			runnerId: "runner-1",
			mem: 4,
			cpu: 2,
			image: "ghcr.io/virtool/ts-pathoscope:1.0.0",
			runtimeVersion: "1.2.3",
			workflowVersion: "4.5.6",
		});

		expect(body.steps).toEqual(
			STEPS.map((step) => ({ ...step, startedAt: null })),
		);

		const [row] = await db
			.select({ claim: jobs.claim, steps: jobs.steps })
			.from(jobs)
			.where(eq(jobs.id, body.id));

		expect(row?.claim).toEqual({
			runner_id: "runner-1",
			mem: 4,
			cpu: 2,
			image: "ghcr.io/virtool/ts-pathoscope:1.0.0",
			runtime_version: "1.2.3",
			workflow_version: "4.5.6",
		});

		expect(row?.steps).toEqual(
			STEPS.map((step) => ({ ...step, started_at: null })),
		);
	});

	it("reports 404 when no job is waiting", async () => {
		const response = await handleClaimJob(deps, claimRequest("pathoscope"));

		expect(response.status).toBe(404);
	});

	it("takes the oldest waiting job", async () => {
		const older = await seedPending({ createdAt: new Date("2026-01-01") });
		await seedPending({ createdAt: new Date("2026-06-01") });

		const body = await (
			await handleClaimJob(deps, claimRequest("pathoscope"))
		).json();

		expect(body.id).toBe(older.id);
	});

	// Two waiting jobs, three runners: each job goes to exactly one of them and
	// the third is told to keep polling. The fixture opens a single connection,
	// so these serialise rather than race — what this pins is that a claimed job
	// is no longer claimable, which is the half that `SKIP LOCKED` does not do.
	it("never hands the same job to two runners", async () => {
		const first = await seedPending({ createdAt: new Date("2026-01-01") });
		const second = await seedPending({ createdAt: new Date("2026-06-01") });

		const claims = await Promise.all([
			handleClaimJob(deps, claimRequest("pathoscope")),
			handleClaimJob(deps, claimRequest("pathoscope")),
			handleClaimJob(deps, claimRequest("pathoscope")),
		]);

		const claimed = await Promise.all(
			claims.filter((each) => each.status === 200).map((each) => each.json()),
		);

		expect(claimed.map((each) => each.id).sort()).toEqual(
			[first.id, second.id].sort(),
		);

		expect(claims.filter((each) => each.status === 404)).toHaveLength(1);
	});

	it("ignores a job waiting on another workflow", async () => {
		await seedPending({ workflow: "nuvs" });

		const response = await handleClaimJob(deps, claimRequest("pathoscope"));

		expect(response.status).toBe(404);
	});

	it("leaves a job that is not pending alone", async () => {
		await seedRunning();

		const response = await handleClaimJob(deps, claimRequest("pathoscope"));

		expect(response.status).toBe(404);
	});

	it.each(["not_a_workflow", ""])(
		"reports 422 for %j as a workflow",
		async (workflow) => {
			await seedPending();

			expect((await handleClaimJob(deps, claimRequest(workflow))).status).toBe(
				422,
			);
		},
	);

	it("reports 422 when no workflow is named", async () => {
		await seedPending();

		expect((await handleClaimJob(deps, claimRequest(null))).status).toBe(422);
	});

	// `build_index` rows exist and must still parse on the read path, but Python
	// builds indexes through a task now, so no runner is waiting on one. Handing
	// one out would start a pod nothing finishes.
	it("refuses to hand out a build_index job", async () => {
		await seedPending({ workflow: "build_index" });

		const response = await handleClaimJob(deps, claimRequest("build_index"));

		expect(response.status).toBe(422);
	});

	it("reports 400 for a body that is not a claim", async () => {
		await seedPending();

		const response = await handleClaimJob(
			deps,
			claimRequest("pathoscope", { runnerId: "runner-1" }),
		);

		expect(response.status).toBe(400);
	});

	it("emits a job update", async () => {
		const pending = await seedPending();

		await handleClaimJob(deps, claimRequest("pathoscope"));

		expect(emit).toHaveBeenCalledWith("jobs", pending.id, "update");
	});
});

describe("handleReadJob", () => {
	it("returns the job the runner claimed", async () => {
		const job = await seedRunning();

		const response = await handleReadJob(
			deps,
			authorized(job, `/jobs/${job.id}`),
			String(job.id),
		);

		expect(response.status).toBe(200);

		const body = await response.json();

		expect(body.id).toBe(job.id);
		expect(body.state).toBe("running");
		expect(body.user).toEqual({ id: userId, handle: "bob" });
		expect(body.steps).toEqual(
			STEPS.map((step) => ({ ...step, startedAt: null })),
		);
	});

	// A run reads its arguments back here, because the claim response carries
	// none. `args` is recomposed from the owning row's reverse foreign key.
	it("carries the arguments recomposed from the owning resource", async () => {
		const job = await seedRunning();

		await db.insert(subtractions).values({
			created_at: new Date(),
			deleted: false,
			job_id: job.id,
			name: "Arabidopsis",
			nickname: "",
			ready: false,
			user_id: userId,
		});

		const body = await (
			await handleReadJob(
				deps,
				authorized(job, `/jobs/${job.id}`),
				String(job.id),
			)
		).json();

		expect(body.args.subtraction_id).toBeDefined();
	});
});

// `jobs.workflow` is a `text` column with no CHECK constraint behind it, so a
// row can name a workflow this build has never heard of. The runner parses the
// response with the same schema and could do nothing with the failure, so the
// read fails here instead — where the data is owned and the row can be named.
describe("the job wire contract", () => {
	it("serves a row that fits it", async () => {
		const job = await seedRunning();
		const captureException = vi.fn();

		const response = await appWith(captureException).request(
			authorized(job, `/jobs/${job.id}`),
		);

		expect(response.status).toBe(200);
		expect((await response.json()).workflow).toBe("pathoscope");
		expect(captureException).not.toHaveBeenCalled();
	});

	it("answers 500 and reports the row for one that does not", async () => {
		const job = await seedRunning();

		await db
			.update(jobs)
			.set({ workflow: "not_a_workflow" })
			.where(eq(jobs.id, job.id));

		const captureException = vi.fn();

		const response = await appWith(captureException).request(
			authorized(job, `/jobs/${job.id}`),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ message: "Internal server error" });

		// The event has to name the job, or an operator has a schema complaint and
		// no row to go and look at.
		expect(captureException).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringMatching(
					new RegExp(`job ${job.id} does not fit the wire contract: workflow`),
				),
			}),
		);
	});
});

describe("handlePingJob", () => {
	it("records the heartbeat and reports when it happened", async () => {
		const job = await seedRunning();

		const before = new Date();

		const response = await handlePingJob(
			deps,
			authorized(job, `/jobs/${job.id}/ping`, "PUT"),
			String(job.id),
		);

		expect(response.status).toBe(200);

		const { pingedAt } = await response.json();

		expect(new Date(pingedAt).getTime()).toBeGreaterThanOrEqual(
			before.getTime() - 1000,
		);

		const [row] = await db
			.select({ pinged_at: jobs.pinged_at })
			.from(jobs)
			.where(eq(jobs.id, job.id));

		expect(row?.pinged_at).not.toBeNull();
	});

	// A ping per five seconds per running job, and every job on screen holds its
	// own detail query. A frame each would cost a refetch per job per five
	// seconds for a timestamp nothing displays.
	it("emits nothing", async () => {
		const job = await seedRunning();

		await handlePingJob(
			deps,
			authorized(job, `/jobs/${job.id}/ping`, "PUT"),
			String(job.id),
		);

		expect(emit).not.toHaveBeenCalled();
	});

	// The whole of the cancellation channel. A cancelled job's key stops
	// authenticating, so its runner's next ping is refused — and the refusal says
	// which terminal state it hit, which is how the pod's logs distinguish a
	// cancellation from a ping-timeout sweep from a broken credential.
	it("refuses a cancelled job's ping, saying so", async () => {
		const job = await seedJob(db, userId, { state: "cancelled" });

		const response = await handlePingJob(
			deps,
			authorized(job, `/jobs/${job.id}/ping`, "PUT"),
			String(job.id),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: "Job is cancelled." });
	});

	it("refuses a job the sweep has already failed", async () => {
		const job = await seedJob(db, userId, { state: "failed" });

		const response = await handlePingJob(
			deps,
			authorized(job, `/jobs/${job.id}/ping`, "PUT"),
			String(job.id),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: "Job has failed." });
	});
});

describe("handleStartJobStep", () => {
	it("starts the named step and no other", async () => {
		const job = await seedRunning();

		const response = await handleStartJobStep(
			deps,
			authorized(
				job,
				`/jobs/${job.id}/steps/map_default_isolates/start`,
				"POST",
			),
			String(job.id),
			"map_default_isolates",
		);

		expect(response.status).toBe(200);

		const body = await response.json();

		expect(body.id).toBe("map_default_isolates");

		const [row] = await db
			.select({ steps: jobs.steps })
			.from(jobs)
			.where(eq(jobs.id, job.id));

		expect(row?.steps?.map((step) => step.started_at === null)).toEqual([
			true,
			false,
		]);

		// The contract carries a `Date`, but JSON has no date type — so what
		// actually crosses is the same ISO string it always was, and it is the
		// same string the column holds. Python reads both, so neither may move.
		expect(body.startedAt).toEqual(expect.any(String));
		expect(body.startedAt).toBe(row?.steps?.[1]?.started_at);
	});

	it("reports 404 for a step the job does not have", async () => {
		const job = await seedRunning();

		const response = await handleStartJobStep(
			deps,
			authorized(job, `/jobs/${job.id}/steps/nope/start`, "POST"),
			String(job.id),
			"nope",
		);

		expect(response.status).toBe(404);
	});

	// A retry that re-ran a step would silently reset its start time and, with
	// progress derived from started steps, walk the bar backwards.
	it("reports 409 for a step that has already started", async () => {
		const job = await seedRunning();

		const start = () =>
			handleStartJobStep(
				deps,
				authorized(job, `/jobs/${job.id}/steps/prepare_reads/start`, "POST"),
				String(job.id),
				"prepare_reads",
			);

		expect((await start()).status).toBe(200);
		expect((await start()).status).toBe(409);
	});

	it("emits a job update", async () => {
		const job = await seedRunning();

		await handleStartJobStep(
			deps,
			authorized(job, `/jobs/${job.id}/steps/prepare_reads/start`, "POST"),
			String(job.id),
			"prepare_reads",
		);

		expect(emit).toHaveBeenCalledWith("jobs", job.id, "update");
	});
});

describe("handleFinishJob", () => {
	it("moves a running job to succeeded", async () => {
		const job = await seedRunning();

		const response = await handleFinishJob(
			deps,
			authorized(job, `/jobs/${job.id}/finish`, "POST"),
			String(job.id),
		);

		expect(response.status).toBe(200);
		expect((await response.json()).state).toBe("succeeded");

		const [row] = await db
			.select({ state: jobs.state, finished_at: jobs.finished_at })
			.from(jobs)
			.where(eq(jobs.id, job.id));

		expect(row?.state).toBe("succeeded");
		expect(row?.finished_at).not.toBeNull();
	});

	// A terminal job's key stops authenticating, so a second finish is refused
	// by the guard rather than reaching the conflict. Both are refusals; this
	// pins which one, so a change to either is visible.
	it("refuses a second finish", async () => {
		const job = await seedRunning();

		await handleFinishJob(
			deps,
			authorized(job, `/jobs/${job.id}/finish`, "POST"),
			String(job.id),
		);

		const again = await handleFinishJob(
			deps,
			authorized(job, `/jobs/${job.id}/finish`, "POST"),
			String(job.id),
		);

		expect(again.status).toBe(401);
	});

	it("reports 409 for a job that is not running", async () => {
		const job = await seedJob(db, userId, { state: "pending" });

		const response = await handleFinishJob(
			deps,
			authorized(job, `/jobs/${job.id}/finish`, "POST"),
			String(job.id),
		);

		expect(response.status).toBe(409);
	});

	it("emits a job update", async () => {
		const job = await seedRunning();

		await handleFinishJob(
			deps,
			authorized(job, `/jobs/${job.id}/finish`, "POST"),
			String(job.id),
		);

		expect(emit).toHaveBeenCalledWith("jobs", job.id, "update");
	});
});

// Python enforces this in its auth middleware. Here it is the handlers' job,
// which is what `JobPrincipal` carrying the id is for — so it has to hold on
// every route that takes one, not merely the first one written.
describe("cross-job authorization", () => {
	it.each([
		[
			"read",
			(job: SeededJob, other: SeededJob) =>
				handleReadJob(
					deps,
					authorized(job, `/jobs/${other.id}`),
					String(other.id),
				),
		],
		[
			"ping",
			(job: SeededJob, other: SeededJob) =>
				handlePingJob(
					deps,
					authorized(job, `/jobs/${other.id}/ping`, "PUT"),
					String(other.id),
				),
		],
		[
			"start step",
			(job: SeededJob, other: SeededJob) =>
				handleStartJobStep(
					deps,
					authorized(
						job,
						`/jobs/${other.id}/steps/prepare_reads/start`,
						"POST",
					),
					String(other.id),
					"prepare_reads",
				),
		],
		[
			"finish",
			(job: SeededJob, other: SeededJob) =>
				handleFinishJob(
					deps,
					authorized(job, `/jobs/${other.id}/finish`, "POST"),
					String(other.id),
				),
		],
	])("refuses %s with another job's credential", async (_, call) => {
		const job = await seedRunning();
		const other = await seedRunning();

		const response = await call(job, other);

		expect(response.status).toBe(403);

		// The other job is untouched — a 403 that had already done the work would
		// be worse than one that never happened.
		const [row] = await db
			.select({ state: jobs.state, steps: jobs.steps })
			.from(jobs)
			.where(eq(jobs.id, other.id));

		expect(row?.state).toBe("running");
		expect(row?.steps?.every((step) => step.started_at === null)).toBe(true);
	});

	it("reports 404 for a job id that is not a row id", async () => {
		const job = await seedRunning();

		const response = await handleReadJob(
			deps,
			authorized(job, "/jobs/nope"),
			"nope",
		);

		expect(response.status).toBe(404);
	});
});
