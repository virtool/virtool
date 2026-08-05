import { afterEach, describe, expect, it } from "vitest";
import { createRecordingLogger } from "../testFixtures";
import {
	respondJson,
	respondText,
	startTestServer,
	type TestServer,
	type TestServerHandler,
	UNREACHABLE_BASE_URL,
} from "../testServer";
import { createJobsApiClient, type JobsApiClient } from "./client";
import {
	BadRequestError,
	ConflictError,
	ForbiddenError,
	JobsApiError,
	NotFoundError,
	ServerError,
	TransportError,
	UnauthorizedError,
} from "./errors";

const JOB_ID = 17;
const KEY = "bocxcbnu";

let server: TestServer | undefined;
let client: JobsApiClient | undefined;

afterEach(async () => {
	await client?.close();
	await server?.close();

	server = undefined;
	client = undefined;
});

async function setup(
	handler: TestServerHandler,
	options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<JobsApiClient> {
	server = await startTestServer(handler);

	client = createJobsApiClient({
		baseUrl: options.baseUrl ?? server.baseUrl,
		jobId: JOB_ID,
		key: KEY,
		logger: createRecordingLogger().logger,
		signal: options.signal ?? new AbortController().signal,
	});

	return client;
}

function job(overrides: Record<string, unknown> = {}) {
	return {
		id: JOB_ID,
		args: { sample_id: "foo" },
		claim: null,
		claimedAt: null,
		createdAt: "2026-08-05T00:00:00Z",
		pingedAt: null,
		progress: 0,
		state: "running",
		steps: null,
		user: { id: 1, handle: "bob", administrator_role: null },
		workflow: "create_subtraction",
		...overrides,
	};
}

describe("authentication", () => {
	it("sends the job's basic credentials on every request", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 200, job()),
		);

		await client.getJob();

		const expected = Buffer.from(`job-${JOB_ID}:${KEY}`).toString("base64");

		expect(server?.requests[0]?.headers.authorization).toBe(
			`Basic ${expected}`,
		);
	});

	it("decodes to the job- handle the jobs api reserves for a runner", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 200, job()),
		);

		await client.getJob();

		const header = String(server?.requests[0]?.headers.authorization);

		expect(Buffer.from(header.replace("Basic ", ""), "base64").toString()).toBe(
			`job-17:${KEY}`,
		);
	});
});

describe("paths", () => {
	it("uses unprefixed paths matching python's", async () => {
		const client = await setup((request, response) => {
			if (request.path.endsWith("/ping")) {
				respondJson(response, 200, {
					cancelled: false,
					pingedAt: "2026-08-05T00:00:00Z",
				});
				return;
			}

			if (request.path === `/jobs/${JOB_ID}`) {
				respondJson(response, 200, job());
				return;
			}

			respondJson(response, 200, {});
		});

		await client.getJob();
		await client.ping();
		await client.startStep("map_default_isolates");
		await client.finish();

		expect(
			server?.requests.map((request) => `${request.method} ${request.path}`),
		).toEqual([
			"GET /jobs/17",
			"PUT /jobs/17/ping",
			"POST /jobs/17/steps/map_default_isolates/start",
			"POST /jobs/17/finish",
		]);
	});

	it("carries no /jobs-api prefix", async () => {
		const client = await setup((_, response) => respondJson(response, 200, {}));

		await client.finish();

		expect(server?.requests[0]?.path).not.toContain("jobs-api");
	});

	it("keeps a path prefix already on the base url", async () => {
		server = await startTestServer((_, response) =>
			respondJson(response, 200, {}),
		);

		client = createJobsApiClient({
			baseUrl: `${server.baseUrl}/internal`,
			jobId: JOB_ID,
			key: KEY,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});

		await client.finish();

		expect(server.requests[0]?.path).toBe("/internal/jobs/17/finish");
	});
});

describe("status mapping", () => {
	it.each([
		[400, BadRequestError],
		[401, UnauthorizedError],
		[403, ForbiddenError],
		[404, NotFoundError],
		[409, ConflictError],
		[500, ServerError],
	])("maps %i to its named error", async (status, Expected) => {
		const client = await setup((_, response) =>
			respondJson(response, status, { message: "no good" }),
		);

		const caught = await client.finish().catch((err: unknown) => err);

		expect(caught).toBeInstanceOf(Expected);
		expect(caught).toMatchObject({
			status,
			message: "no good",
			method: "POST",
			path: "/jobs/17/finish",
		});
	});

	it("falls back to the response text when the body is not json", async () => {
		const client = await setup((_, response) =>
			respondText(response, 403, "nope"),
		);

		await expect(client.finish()).rejects.toThrow("nope");
	});

	it("stringifies a json body with no message key", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 400, { detail: "nope" }),
		);

		await expect(client.finish()).rejects.toThrow('{"detail":"nope"}');
	});

	it("throws a jobs API error naming an unmapped status", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 418, { message: "teapot" }),
		);

		const caught = await client.finish().catch((err: unknown) => err);

		expect(caught).toBeInstanceOf(JobsApiError);
		expect(caught).not.toBeInstanceOf(ServerError);
		expect((caught as JobsApiError).status).toBe(418);
		expect((caught as Error).message).toContain("418");
	});

	it("does not retry a status error", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 409, { message: "already finished" }),
		);

		await expect(client.finish()).rejects.toBeInstanceOf(ConflictError);

		expect(server?.requests).toHaveLength(1);
	});
});

describe("response parsing", () => {
	it("parses the body with the wire schema", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 200, job({ progress: 42 })),
		);

		await expect(client.getJob()).resolves.toMatchObject({
			id: JOB_ID,
			progress: 42,
			args: { sample_id: "foo" },
		});
	});

	it("rejects a body the schema does not accept", async () => {
		const client = await setup((_, response) =>
			respondJson(response, 200, { id: "not a number" }),
		);

		await expect(client.getJob()).rejects.toBeInstanceOf(JobsApiError);
	});
});

describe("transport failures", () => {
	it("reports an unreachable jobs API as a transport error", async () => {
		const client = await setup(
			(_, response) => respondJson(response, 200, {}),
			{
				baseUrl: UNREACHABLE_BASE_URL,
			},
		);

		const caught = await client
			.request({ method: "POST", path: "/jobs/17/finish", retries: 0 })
			.catch((err: unknown) => err);

		expect(caught).toBeInstanceOf(TransportError);
		expect((caught as TransportError).path).toBe("/jobs/17/finish");
	});

	it("does not classify the run's own cancellation as a transport error", async () => {
		const controller = new AbortController();

		const client = await setup(
			() => {
				controller.abort();

				// Never answered, so the abort is what ends the request.
				return undefined;
			},
			{ signal: controller.signal },
		);

		const caught = await client.finish().catch((err: unknown) => err);

		expect(caught).not.toBeInstanceOf(TransportError);
	});
});
