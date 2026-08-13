import {
	Job,
	JobClaimed,
	JobStepStarted,
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowSample,
	WorkflowSettings,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { describe, expect, it, onTestFinished } from "vitest";
import { createJobsApiClient } from "../../client/client";
import {
	ConflictError,
	NotFoundError,
	TransportError,
	UnauthorizedError,
} from "../../client/errors";
import { claimJob } from "../../lifecycle/claim";
import {
	createFakeAnalysis,
	createFakeIndex,
	createFakeSample,
	createFakeSubtraction,
} from "../builders";
import { createRecordingLogger } from "../logger";
import { startJobsApiTestServer } from "./server";
import { createJobsApiState, type JobsApiState } from "./state";

function basic(jobId: number, key: string): string {
	return `Basic ${Buffer.from(`job-${jobId}:${key}`).toString("base64")}`;
}

const CLAIM_REQUEST = {
	runnerId: "runner-1",
	mem: 8,
	cpu: 2,
	image: "ghcr.io/virtool/ts-create-subtraction:1.0.0",
	runtimeVersion: "1.0.0",
	workflowVersion: "1.0.0",
	steps: [
		{ id: "prepare", name: "Prepare", description: "Prepare the run." },
		{ id: "run", name: "Run", description: "Do the work." },
	],
};

async function setup(overrides: Parameters<typeof createJobsApiState>[0] = {}) {
	const state = createJobsApiState(overrides);
	const server = await startJobsApiTestServer(state);

	onTestFinished(() => server.close());

	return { state, server };
}

function connect(
	state: JobsApiState,
	baseUrl: string,
	{ key = state.key }: { key?: string } = {},
) {
	const controller = new AbortController();

	const client = createJobsApiClient({
		baseUrl,
		jobId: state.job.id,
		key,
		logger: createRecordingLogger().logger,
		signal: controller.signal,
	});

	onTestFinished(() => client.close());

	return client;
}

describe("the lifecycle, end to end", () => {
	// Python's cancellation path, reproduced: claim, start a step, ping, flip the
	// job, and watch the next ping refuse.
	it("claims, starts a step, pings, and reports cancellation on the next ping", async () => {
		const { state, server } = await setup();

		const claimed = await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: CLAIM_REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});

		expect(claimed).not.toBeNull();
		expect(claimed?.key).toBe(state.key);
		expect(claimed?.state).toBe("running");
		expect(state.acquired).toBe(true);

		const client = connect(state, server.baseUrl);

		await client.startStep("prepare");

		expect(state.stepStartUpdates).toEqual(["prepare"]);
		expect(state.job.steps?.[0]?.startedAt).not.toBeNull();
		expect(state.job.steps?.[1]?.startedAt).toBeNull();

		const ping = await client.ping();

		expect(ping.pingedAt).toBeInstanceOf(Date);

		state.job.state = "cancelled";

		// **The refusal is the cancellation channel.** `JobPing` carries no
		// `cancelled` flag and never will: a flag would have to be readable by a
		// credential the same transition revokes. The ping loop keys on this 401.
		await expect(client.ping()).rejects.toThrow(UnauthorizedError);
		await expect(client.ping()).rejects.toThrow("Job is cancelled.");
	});

	it("answers a second claim with a 404, the way no-job-available is answered", async () => {
		const { server } = await setup();

		const logger = createRecordingLogger().logger;
		const signal = AbortSignal.timeout(300);

		await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: CLAIM_REQUEST,
			logger,
			signal: new AbortController().signal,
		});

		// 404 is "keep polling", so the second claim runs out its signal and
		// returns null rather than throwing.
		await expect(
			claimJob({
				baseUrl: server.baseUrl,
				workflow: "create_subtraction",
				request: CLAIM_REQUEST,
				logger,
				signal,
				pollIntervalMs: 20,
			}),
		).resolves.toBeNull();
	});

	// Handing a `create_subtraction` job to a runner asking for `nuvs` would let a
	// test pass with a claim configuration the real service answers 404 to, which
	// in production is a pod polling until its timeout.
	it("answers a claim for another workflow the way no-job-available is answered", async () => {
		const { server } = await setup();

		await expect(
			claimJob({
				baseUrl: server.baseUrl,
				workflow: "nuvs",
				request: CLAIM_REQUEST,
				logger: createRecordingLogger().logger,
				signal: AbortSignal.timeout(300),
				pollIntervalMs: 20,
			}),
		).resolves.toBeNull();
	});

	// `build_index` parses as a job workflow — rows exist — but nothing creates
	// one any more, so the claim refuses it rather than hanging.
	it("answers a claim for an unclaimable workflow with a 422", async () => {
		const { server } = await setup();

		const response = await fetch(
			`${server.baseUrl}/jobs/claim?workflow=build_index`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(CLAIM_REQUEST),
			},
		);

		expect(response.status).toBe(422);
	});

	// Finishing is a terminal transition, so it revokes the key that made it.
	// Every later call is refused as a credential — the way `requireJobRequest`
	// refuses one — rather than reaching a handler that answers 409.
	it("records finish and revokes the key it was made with", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		await client.finish();

		expect(state.finishCalled).toBe(true);
		expect(state.job.state).toBe("succeeded");

		await expect(client.finish()).rejects.toThrow(UnauthorizedError);
		await expect(client.getJob()).rejects.toThrow("Job has succeeded.");
	});

	it("answers an unknown step id with a 404", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		await expect(client.startStep("no_such_step")).rejects.toThrow(
			"No step no_such_step",
		);
		expect(state.stepStartUpdates).toEqual([]);
	});

	// Progress is derived from how many steps have started, so a silent restamp
	// would move a job's progress without moving its work.
	it("answers a second start of the same step with a 409", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		await client.startStep("prepare");

		await expect(client.startStep("prepare")).rejects.toThrow(ConflictError);
		expect(state.stepStartUpdates).toEqual(["prepare"]);
	});
});

describe("the wire contract", () => {
	// The reason this server is camelCase: spelled snake_case on both sides,
	// server and client would agree with each other and the mismatch would
	// surface only against the real `apps/jobs-api`.
	it("stamps a started step with startedAt, never started_at", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		const started = await client.request({
			method: "POST",
			path: `/jobs/${state.job.id}/steps/prepare/start`,
			body: {},
			schema: JobStepStarted,
		});

		expect(started.startedAt).toBeInstanceOf(Date);

		const raw = JSON.parse(
			await (
				await fetch(`${server.baseUrl}/jobs/${state.job.id}`, {
					headers: { authorization: basic(state.job.id, state.key) },
				})
			).text(),
		) as { steps: Record<string, unknown>[] };

		expect(raw.steps[0]).toHaveProperty("startedAt");
		expect(raw.steps[0]).not.toHaveProperty("started_at");
	});

	it("serves every metadata read the contract describes", async () => {
		const sample = createFakeSample();
		const subtraction = createFakeSubtraction();
		const index = createFakeIndex();
		const analysis = createFakeAnalysis();

		const { state, server } = await setup({
			analyses: new Map([[analysis.id, analysis]]),
			indexes: new Map([[index.id, index]]),
			samples: new Map([[sample.id, sample]]),
			subtractions: new Map([[subtraction.id, subtraction]]),
		});

		const client = connect(state, server.baseUrl);

		await expect(
			client.request({
				method: "GET",
				path: `/samples/${sample.id}`,
				schema: WorkflowSample,
			}),
		).resolves.toEqual(sample);

		await expect(
			client.request({
				method: "GET",
				path: `/subtractions/${subtraction.id}`,
				schema: WorkflowSubtraction,
			}),
		).resolves.toEqual(subtraction);

		await expect(
			client.request({
				method: "GET",
				path: `/indexes/${index.id}`,
				schema: WorkflowIndex,
			}),
		).resolves.toEqual(index);

		await expect(
			client.request({
				method: "GET",
				path: `/analyses/${analysis.id}`,
				schema: WorkflowAnalysis,
			}),
		).resolves.toEqual(analysis);

		await expect(
			client.request({
				method: "GET",
				path: "/settings",
				schema: WorkflowSettings,
			}),
		).resolves.toEqual(state.settings);
	});

	it("answers a metadata read for a row it does not hold with a 404", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		await expect(
			client.request({ method: "GET", path: "/samples/404" }),
		).rejects.toThrow(NotFoundError);
	});
});

describe("authentication", () => {
	it("rejects a request with no credentials", async () => {
		const { state, server } = await setup();

		const response = await fetch(`${server.baseUrl}/jobs/${state.job.id}`);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			message: "Invalid credentials",
		});
	});

	it("rejects a request carrying the wrong key", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl, { key: "not-the-key" });

		await expect(client.getJob()).rejects.toThrow(UnauthorizedError);
	});

	it("rejects a handle that is not job-{id}", async () => {
		const { state, server } = await setup();

		const response = await fetch(`${server.baseUrl}/jobs/${state.job.id}`, {
			headers: {
				authorization: `Basic ${Buffer.from(`bob:${state.key}`).toString("base64")}`,
			},
		});

		expect(response.status).toBe(401);
	});

	// The real guard is the floor under *every* handler, so a terminal job's key
	// stops working on the metadata reads and the finalize calls too — not only
	// on the ping, which is merely where a run notices.
	it("refuses a terminal job's key on every route, naming the state", async () => {
		const sample = createFakeSample();

		const { state, server } = await setup({
			samples: new Map([[sample.id, sample]]),
		});

		const client = connect(state, server.baseUrl);

		state.job.state = "failed";

		await expect(client.getJob()).rejects.toThrow(UnauthorizedError);
		await expect(client.startStep("prepare")).rejects.toThrow(
			"Job has failed.",
		);
		await expect(
			client.request({ method: "GET", path: `/samples/${sample.id}` }),
		).rejects.toThrow("Job has failed.");
		await expect(
			client.request({ method: "GET", path: "/settings" }),
		).rejects.toThrow("Job has failed.");

		expect(state.stepStartUpdates).toEqual([]);
	});

	// The key comes back *from* the claim, so there is nothing to authenticate
	// with yet.
	it("lets the claim through unauthenticated", async () => {
		const { server } = await setup();

		const response = await fetch(
			`${server.baseUrl}/jobs/claim?workflow=create_subtraction`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(CLAIM_REQUEST),
			},
		);

		expect(response.status).toBe(200);
		expect(JobClaimed.safeParse(await response.json()).success).toBe(true);
	});

	// The guard runs first, so a credential naming another job is refused as a
	// credential. The 403 is what is left for a *valid* credential reaching a
	// path that names someone else's job — a distinction the handlers make and
	// the guard deliberately does not.
	it("answers a valid credential on another job's path with a 403", async () => {
		const { state, server } = await setup();

		const response = await fetch(`${server.baseUrl}/jobs/${state.job.id + 1}`, {
			headers: { authorization: basic(state.job.id, state.key) },
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ message: "Forbidden" });
	});
});

describe("failure injection", () => {
	it("returns an arbitrary status, mapped to the client's named error", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		server.respondNextWith(409, { message: "already finished" });

		await expect(client.getJob()).rejects.toThrow(ConflictError);

		// A status is a decision the jobs API made. Repeating it five times over
		// 25 s would be a bug, so exactly one request reached the server.
		expect(server.requests).toHaveLength(1);
	});

	it("destroys a socket, which the client classifies as retryable", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		server.destroyNextRequest();

		await expect(
			client.request({
				method: "GET",
				path: `/jobs/${state.job.id}`,
				retries: 0,
			}),
		).rejects.toThrow(TransportError);
	});

	it("retries a destroyed socket and succeeds on the next attempt", {
		timeout: 20_000,
	}, async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		server.destroyNextRequest();

		// One retry at the flat 5 s delay. The delay is Python's observed
		// behaviour and the ping-timeout sweep is calibrated against it, so it
		// is paid here rather than shortened.
		const job = await client.request({
			method: "GET",
			path: `/jobs/${state.job.id}`,
			retries: 1,
			schema: Job,
		});

		expect(job.id).toBe(state.job.id);
		expect(server.requests).toHaveLength(2);
	});

	it("holds a response open until the caller's own signal gives up", async () => {
		const { state, server } = await setup();
		const client = connect(state, server.baseUrl);

		server.hangNextRequest();

		await expect(
			client.request({
				method: "GET",
				path: `/jobs/${state.job.id}`,
				retries: 0,
				signal: AbortSignal.timeout(200),
			}),
		).rejects.toThrow();
	});
});
