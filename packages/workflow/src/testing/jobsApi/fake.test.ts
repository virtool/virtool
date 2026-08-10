import {
	CacheRegistered,
	WorkflowSample,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import {
	ConflictError,
	NotFoundError,
	UnauthorizedError,
} from "../../client/errors";
import {
	createFakeNewSample,
	createFakeNewSubtraction,
	createFakeQuality,
	createFakeSample,
} from "../builders";
import { createFakeJobsApiClient } from "./fake";
import { createJobsApiState } from "./state";

describe("the lifecycle, without a socket", () => {
	it("records step starts and finish on the shared state", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		state.job.steps = [
			{
				id: "prepare",
				name: "Prepare",
				description: "Prepare the run.",
				startedAt: null,
			},
		];

		await client.startStep("prepare");
		await client.finish();

		expect(state.stepStartUpdates).toEqual(["prepare"]);
		expect(state.finishCalled).toBe(true);
		expect(state.job.state).toBe("succeeded");
	});

	// Driven exactly as the embedded server drives it, so a test moves between
	// the two without rewriting its setup.
	it("reports cancellation on the next ping once the job goes terminal", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		await expect(client.ping()).resolves.toHaveProperty("pingedAt");

		state.job.state = "cancelled";

		await expect(client.ping()).rejects.toThrow(UnauthorizedError);
		await expect(client.ping()).rejects.toThrow("Job is cancelled.");
	});

	it("maps every other status to the same error the real client throws", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		await expect(client.startStep("no_such_step")).rejects.toThrow(
			NotFoundError,
		);

		await client.startStep("prepare");

		// Progress is derived from how many steps have started, so a restamp would
		// move a job's progress without moving its work.
		await expect(client.startStep("prepare")).rejects.toThrow(ConflictError);
		expect(state.stepStartUpdates).toEqual(["prepare"]);
	});

	// Finishing is a terminal transition, so it revokes the key that made it. The
	// second call is refused as a credential, exactly as the real service refuses
	// it in `requireJobRequest` — not as a 409 from a handler it never reaches.
	it("refuses every call once the job has finished", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		await client.finish();

		expect(state.job.state).toBe("succeeded");

		await expect(client.finish()).rejects.toThrow(UnauthorizedError);
		await expect(client.getJob()).rejects.toThrow("Job has succeeded.");
		await expect(client.startStep("prepare")).rejects.toThrow(
			UnauthorizedError,
		);
	});

	it("abandons a call whose signal has already aborted", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		await expect(client.ping(AbortSignal.abort())).rejects.toThrow();
	});
});

describe("recorded calls", () => {
	it("records a finalize manifest for assertion", async () => {
		const subtraction = createFakeNewSubtraction();

		const state = createJobsApiState({
			subtractions: new Map([[subtraction.id, subtraction]]),
		});

		const client = createFakeJobsApiClient(state);

		const finalized = await client.request({
			method: "PATCH",
			path: `/subtractions/${subtraction.id}`,
			body: {
				count: 12,
				gc: { a: 0.25, c: 0.25, g: 0.25, t: 0.24, n: 0.01 },
				files: [
					{
						kind: "subtractionFile",
						name: "subtraction.fa.gz",
						storageKey: `subtractions/${subtraction.id}/abc`,
					},
				],
			},
			schema: WorkflowSubtraction,
		});

		expect(finalized.ready).toBe(true);
		expect(state.finalizeCalls).toHaveLength(1);
		expect(state.finalizeCalls[0]).toMatchObject({
			resource: "subtraction",
			id: subtraction.id,
			request: { count: 12 },
		});
	});

	it("records a cache registration and composes its key from the uuid", async () => {
		const state = createJobsApiState();
		const client = createFakeJobsApiClient(state);

		const uuid = "0".repeat(32);

		const registered = await client.request({
			method: "POST",
			path: "/caches",
			body: { key: "abc123", uuid, params: {} },
			schema: CacheRegistered,
		});

		expect(registered.created).toBe(true);
		expect(registered.storageKey).toBe(`caches/v1/${uuid}`);
		expect(state.cacheRegistrations).toHaveLength(1);

		// Two workflows can derive the same key at once and both blobs hold the
		// same bytes, so the loser is handed the winner's row.
		const second = await client.request({
			method: "POST",
			path: "/caches",
			body: { key: "abc123", uuid: "1".repeat(32), params: {} },
			schema: CacheRegistered,
		});

		expect(second.created).toBe(false);
		expect(second.storageKey).toBe(registered.storageKey);
	});

	// The read path has to be reachable from the write path: a workflow that
	// finalizes a sample and reads it back gets the keys it just declared, the
	// way the real route serves the `sample_reads` rows it just inserted.
	it("records a finalized sample's reads on the row it serves back", async () => {
		const sample = createFakeNewSample();

		const state = createJobsApiState({
			samples: new Map([[sample.id, sample]]),
		});

		const client = createFakeJobsApiClient(state);

		const files = [
			{
				kind: "sampleRead" as const,
				name: "reads_1.fq.gz",
				storageKey: `samples/${sample.id}/abc`,
			},
			{
				kind: "sampleRead" as const,
				name: "reads_2.fq.gz",
				storageKey: `samples/${sample.id}/def`,
			},
		];

		await client.request({
			method: "PATCH",
			path: `/samples/${sample.id}`,
			body: { quality: createFakeQuality(), files },
			schema: WorkflowSample,
		});

		const read = await client.request({
			method: "GET",
			path: `/samples/${sample.id}`,
			schema: WorkflowSample,
		});

		expect(read.paired).toBe(true);
		expect(read.quality).not.toBeNull();
		expect(read.reads.map((entry) => entry.storageKey)).toEqual(
			files.map((file) => file.storageKey),
		);
	});

	it("refuses to finalize a resource it does not hold", async () => {
		const state = createJobsApiState({
			samples: new Map([[1, createFakeSample({ id: 1 })]]),
		});

		const client = createFakeJobsApiClient(state);

		await expect(
			client.request({ method: "PATCH", path: "/samples/2", body: {} }),
		).rejects.toThrow(NotFoundError);
	});
});
