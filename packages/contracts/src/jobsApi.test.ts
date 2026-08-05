import { describe, expect, it } from "vitest";
import {
	CreateJobClaimRequest,
	FinalizeSubtractionRequest,
	fromStoredJobClaim,
	fromStoredJobStep,
	Job,
	JobClaim,
	JobClaimed,
	JobFileManifest,
	JobStep,
	StoredJobClaim,
	StoredJobStep,
	toStoredJobClaim,
	toStoredJobStep,
} from "./jobsApi";

const claim: JobClaim = {
	runnerId: "runner-1",
	mem: 8,
	cpu: 4,
	image: "virtool/nuvs:1.2.3",
	runtimeVersion: "2.0.0",
	workflowVersion: "1.2.3",
};

describe("claim round trip", () => {
	it("keeps camelCase on the wire, snake_case in the column, camelCase back out", () => {
		const parsed = JobClaim.parse(claim);

		const stored = toStoredJobClaim(parsed);

		expect(Object.keys(stored).sort()).toStrictEqual([
			"cpu",
			"image",
			"mem",
			"runner_id",
			"runtime_version",
			"workflow_version",
		]);

		// The column content must survive a JSON round trip byte-for-byte, because
		// Python reads and writes these same keys.
		const fromColumn = StoredJobClaim.parse(JSON.parse(JSON.stringify(stored)));

		expect(fromStoredJobClaim(fromColumn)).toStrictEqual(claim);
	});

	it("rejects a stored claim offered as a wire claim", () => {
		expect(JobClaim.safeParse(toStoredJobClaim(claim)).success).toBe(false);
	});
});

describe("step round trip", () => {
	const step: JobStep = {
		id: "map_subtractions",
		name: "Map subtractions",
		description: "Eliminate reads that map to a subtraction.",
		startedAt: "2026-07-31T16:38:58.852Z",
	};

	it("persists startedAt as started_at and back", () => {
		const stored = toStoredJobStep(JobStep.parse(step));

		expect(stored.started_at).toBe(step.startedAt);
		expect(stored).not.toHaveProperty("startedAt");

		expect(
			fromStoredJobStep(
				StoredJobStep.parse(JSON.parse(JSON.stringify(stored))),
			),
		).toStrictEqual(step);
	});

	it("carries a null startedAt through unstarted", () => {
		const unstarted = { ...step, startedAt: null };

		expect(fromStoredJobStep(toStoredJobStep(unstarted))).toStrictEqual(
			unstarted,
		);
	});
});

describe("wire shapes", () => {
	it("parses a claim response and keeps the one-time key", () => {
		const claimed = JobClaimed.parse({
			id: 12,
			acquired: true,
			claim,
			claimedAt: "2026-07-31T16:38:58.852Z",
			createdAt: "2026-07-31T16:30:00.000Z",
			key: "abc123",
			state: "running",
			steps: [],
			user: { id: 3, handle: "igboyes" },
			workflow: "nuvs",
		});

		expect(claimed.key).toBe("abc123");
		expect(claimed.claim.runnerId).toBe("runner-1");
	});

	it("adds steps to the claim request without re-spelling the claim", () => {
		const request = CreateJobClaimRequest.parse({
			...claim,
			steps: [{ id: "prepare", name: "Prepare", description: "Set up." }],
		});

		expect(request.runnerId).toBe("runner-1");
		expect(request.steps).toHaveLength(1);
	});

	it("accepts a build_index job on the read path", () => {
		// `build_index` stays Python-owned and is never handed out at claim time,
		// but its rows exist and must still parse.
		expect(
			Job.safeParse({
				id: 1,
				args: { index_id: 7 },
				claim: null,
				claimedAt: null,
				createdAt: "2026-07-31T16:30:00.000Z",
				pingedAt: null,
				progress: 0,
				state: "pending",
				steps: null,
				user: { id: 3, handle: "igboyes" },
				workflow: "build_index",
			}).success,
		).toBe(true);
	});

	it("treats args as an opaque JSON object", () => {
		const job = Job.parse({
			id: 1,
			args: { sample_id: 4, nested: { deep: [1, "two", null] } },
			claim: null,
			claimedAt: null,
			createdAt: "2026-07-31T16:30:00.000Z",
			pingedAt: null,
			progress: 0,
			state: "pending",
			steps: null,
			user: { id: 3, handle: "igboyes" },
			workflow: "create_sample",
		});

		expect(job.args).toStrictEqual({
			sample_id: 4,
			nested: { deep: [1, "two", null] },
		});
	});
});

describe("subtraction finalize", () => {
	const gc = { a: 0.25, c: 0.25, g: 0.25, t: 0.24, n: 0.01 };

	it("accepts nucleotide fractions", () => {
		expect(
			FinalizeSubtractionRequest.parse({ count: 12, gc, files: [] }).gc,
		).toStrictEqual(gc);
	});

	it("rejects a composition sent as percentages", () => {
		// The plausible unit error: a workflow finalizing with 25 rather than 0.25.
		expect(
			FinalizeSubtractionRequest.safeParse({
				count: 12,
				gc: { a: 25, c: 25, g: 25, t: 24, n: 1 },
				files: [],
			}).success,
		).toBe(false);
	});

	it("rejects a negative fraction", () => {
		expect(
			FinalizeSubtractionRequest.safeParse({
				count: 12,
				gc: { ...gc, n: -0.01 },
				files: [],
			}).success,
		).toBe(false);
	});
});

describe("file manifest", () => {
	it("narrows by resource kind", () => {
		const manifest = JobFileManifest.parse({
			kind: "analysisFile",
			name: "report.tsv",
			nameOnDisk: "report.tsv",
			size: 4096,
			format: "tsv",
			description: "The formatted report.",
		});

		expect(manifest.kind).toBe("analysisFile");
	});

	it("accepts a size past the 32-bit range", () => {
		// Reads files and Bowtie2 index shards routinely exceed 2 GiB.
		const manifest = JobFileManifest.parse({
			kind: "sampleRead",
			name: "reads_1.fq.gz",
			nameOnDisk: "reads_1.fq.gz",
			size: 8_589_934_592,
		});

		expect(manifest.size).toBe(8_589_934_592);
	});

	it("drops a storage key a runner tries to name", () => {
		// Keys are the jobs API's to derive. A runner that sends one gets it
		// stripped here rather than having it reach the data layer.
		const manifest = JobFileManifest.parse({
			kind: "sampleRead",
			name: "reads_1.fq.gz",
			nameOnDisk: "reads_1.fq.gz",
			size: 1,
			key: "samples/4/reads_1.fq.gz",
		});

		expect(manifest).not.toHaveProperty("key");
	});
});
