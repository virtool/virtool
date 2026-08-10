import type { CreateJobClaimRequest } from "@virtool/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { JobsApiError, ServerError } from "../client/errors";
import {
	createRecordingLogger,
	respondJson,
	startTestServer,
	type TestServer,
	UNREACHABLE_BASE_URL,
} from "../testing";
import { CLAIM_POLL_INTERVAL_MS, claimJob } from "./claim";

const REQUEST: CreateJobClaimRequest = {
	runnerId: "pod-abc-1",
	mem: 4,
	cpu: 2,
	image: "unknown",
	runtimeVersion: "1.2.3",
	workflowVersion: "4.5.6",
	steps: [
		{ id: "map_default_isolates", name: "Map Default", description: "d" },
	],
};

function claimed(overrides: Record<string, unknown> = {}) {
	return {
		id: 9,
		acquired: true,
		claim: {
			runnerId: "pod-abc-1",
			mem: 4,
			cpu: 2,
			image: "unknown",
			runtimeVersion: "1.2.3",
			workflowVersion: "4.5.6",
		},
		claimedAt: "2026-08-05T00:00:00Z",
		createdAt: "2026-08-05T00:00:00Z",
		key: "bocxcbnu",
		state: "running",
		steps: [],
		user: { id: 1, handle: "bob", administrator_role: null },
		workflow: "create_subtraction",
		...overrides,
	};
}

let server: TestServer | undefined;

afterEach(async () => {
	await server?.close();

	server = undefined;
});

it("defaults to python's two second poll interval", () => {
	expect(CLAIM_POLL_INTERVAL_MS).toBe(2_000);
});

describe("claimJob", () => {
	it("returns the parsed claim on 200", async () => {
		server = await startTestServer((_, response) =>
			respondJson(response, 200, claimed()),
		);

		const result = await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});

		expect(result).toMatchObject({ id: 9, key: "bocxcbnu" });
	});

	it("posts to the unprefixed claim path with the workflow as a query parameter", async () => {
		server = await startTestServer((_, response) =>
			respondJson(response, 200, claimed()),
		);

		await claimJob({
			baseUrl: server.baseUrl,
			workflow: "pathoscope",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});

		const request = server.requests[0];

		expect(request?.method).toBe("POST");
		expect(request?.path).toBe("/jobs/claim");
		expect(request?.searchParams.get("workflow")).toBe("pathoscope");
	});

	it("sends every claim field in camelCase", async () => {
		server = await startTestServer((_, response) =>
			respondJson(response, 200, claimed()),
		);

		await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});

		const body = server.requests[0]?.json as Record<string, unknown>;

		expect(Object.keys(body).sort()).toEqual([
			"cpu",
			"image",
			"mem",
			"runnerId",
			"runtimeVersion",
			"steps",
			"workflowVersion",
		]);

		expect(
			Object.keys((body.steps as Record<string, unknown>[])[0]).sort(),
		).toEqual(["description", "id", "name"]);
	});

	it("polls again after a 404", async () => {
		server = await startTestServer((_, response) => {
			if (server && server.requests.length < 3) {
				respondJson(response, 404, { message: "no job" });
				return;
			}

			respondJson(response, 200, claimed());
		});

		const result = await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
			pollIntervalMs: 5,
		});

		expect(result).toMatchObject({ id: 9 });
		expect(server.requests).toHaveLength(3);
	});

	it("warns and polls again when the jobs API is unreachable", async () => {
		const { logger, records } = createRecordingLogger();
		const controller = new AbortController();

		const promise = claimJob({
			baseUrl: UNREACHABLE_BASE_URL,
			workflow: "create_subtraction",
			request: REQUEST,
			logger,
			signal: controller.signal,
			pollIntervalMs: 5,
		});

		await new Promise((resolve) => setTimeout(resolve, 60));

		controller.abort();

		await expect(promise).resolves.toBeNull();

		const warnings = records().filter((record) => record.level === 40);

		expect(warnings.length).toBeGreaterThan(1);
		expect(warnings[0]?.msg).toContain("could not reach the jobs API");
	});

	it("throws on any other status, after logging it", async () => {
		const { logger, records } = createRecordingLogger();

		server = await startTestServer((_, response) =>
			respondJson(response, 500, { message: "broken" }),
		);

		const caught = await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger,
			signal: new AbortController().signal,
		}).catch((err: unknown) => err);

		expect(caught).toBeInstanceOf(ServerError);
		expect((caught as JobsApiError).status).toBe(500);

		const errors = records().filter((record) => record.level === 50);

		expect(errors[0]).toMatchObject({ status: 500 });
	});

	it("throws rather than polling on when a 200 body is not json", async () => {
		server = await startTestServer((_, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end("{ not json");
		});

		const caught = await claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
			pollIntervalMs: 5,
		}).catch((err: unknown) => err);

		expect(caught).toBeInstanceOf(JobsApiError);
		expect(server.requests).toHaveLength(1);
	});

	it("returns null when the signal aborts before a job is available", async () => {
		const controller = new AbortController();

		server = await startTestServer((_, response) =>
			respondJson(response, 404, { message: "no job" }),
		);

		const promise = claimJob({
			baseUrl: server.baseUrl,
			workflow: "create_subtraction",
			request: REQUEST,
			logger: createRecordingLogger().logger,
			signal: controller.signal,
			pollIntervalMs: 5,
		});

		await new Promise((resolve) => setTimeout(resolve, 20));

		controller.abort();

		await expect(promise).resolves.toBeNull();
	});

	it("returns null without polling when the signal is already aborted", async () => {
		server = await startTestServer((_, response) =>
			respondJson(response, 200, claimed()),
		);

		await expect(
			claimJob({
				baseUrl: server.baseUrl,
				workflow: "create_subtraction",
				request: REQUEST,
				logger: createRecordingLogger().logger,
				signal: AbortSignal.abort(),
			}),
		).resolves.toBeNull();

		expect(server.requests).toHaveLength(0);
	});
});
