import { describe, expect, it } from "vitest";
import type { JobClaim } from "./jobs";
import {
	CreateJobClaimRequest,
	FinalizeAnalysisRequest,
	FinalizeSampleRequest,
	FinalizeSubtractionRequest,
	JobClaimed,
	JobFileManifest,
} from "./jobsApi";

const claim: JobClaim = {
	runnerId: "runner-1",
	mem: 8,
	cpu: 4,
	image: "virtool/nuvs:1.2.3",
	runtimeVersion: "2.0.0",
	workflowVersion: "1.2.3",
};

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
});

describe("subtraction finalize", () => {
	const gc = { a: 0.25, c: 0.25, g: 0.25, t: 0.24, n: 0.01 };

	const fasta = {
		kind: "subtractionFile",
		name: "subtraction.fa.gz",
		storageKey: "subtractions/7/0f1e2d3c4b5a69788796a5b4c3d2e1f0",
	};

	it("accepts nucleotide fractions", () => {
		expect(
			FinalizeSubtractionRequest.parse({ count: 12, gc, files: [fasta] }).gc,
		).toStrictEqual(gc);
	});

	it("rejects a composition sent as percentages", () => {
		// The plausible unit error: a workflow finalizing with 25 rather than 0.25.
		expect(
			FinalizeSubtractionRequest.safeParse({
				count: 12,
				gc: { a: 25, c: 25, g: 25, t: 24, n: 1 },
				files: [fasta],
			}).success,
		).toBe(false);
	});

	it("rejects a negative fraction", () => {
		expect(
			FinalizeSubtractionRequest.safeParse({
				count: 12,
				gc: { ...gc, n: -0.01 },
				files: [fasta],
			}).success,
		).toBe(false);
	});

	// A subtraction with no source genome is not a subtraction; accepting one
	// would flip the parent ready with no file rows under it.
	it("rejects an empty manifest", () => {
		expect(
			FinalizeSubtractionRequest.safeParse({ count: 12, gc, files: [] })
				.success,
		).toBe(false);
	});
});

describe("sample finalize", () => {
	const quality = {
		bases: [[30, 31, 32, 33, 34]],
		composition: [[25, 25, 25, 25]],
		count: 1000,
		encoding: "Sanger",
		gc: 0.42,
		length: [100, 100],
		sequences: [1, 2, 3],
	};

	function read(name: string) {
		return {
			kind: "sampleRead",
			name,
			storageKey: `samples/7/${name.replace(/\W/g, "")}0f1e2d3c4b5a6978`,
		};
	}

	it("accepts one read", () => {
		expect(
			FinalizeSampleRequest.parse({ quality, files: [read("reads_1.fq.gz")] })
				.files,
		).toHaveLength(1);
	});

	it("accepts a pair", () => {
		expect(
			FinalizeSampleRequest.safeParse({
				quality,
				files: [read("reads_1.fq.gz"), read("reads_2.fq.gz")],
			}).success,
		).toBe(true);
	});

	// A sample with no reads is not a usable sample.
	it("rejects an empty manifest", () => {
		expect(
			FinalizeSampleRequest.safeParse({ quality, files: [] }).success,
		).toBe(false);
	});

	it("rejects a third read", () => {
		expect(
			FinalizeSampleRequest.safeParse({
				quality,
				files: [
					read("reads_1.fq.gz"),
					read("reads_2.fq.gz"),
					read("reads_3.fq.gz"),
				],
			}).success,
		).toBe(false);
	});
});

describe("analysis finalize", () => {
	// Pathoscope retains no files at all — its whole output is `results`, which
	// is the guard here. Requiring a manifest would make that run unfinalizable.
	it("accepts an empty manifest", () => {
		expect(
			FinalizeAnalysisRequest.parse({ results: { hits: [] }, files: [] }).files,
		).toStrictEqual([]);
	});
});

describe("file manifest", () => {
	it("narrows by resource kind", () => {
		const manifest = JobFileManifest.parse({
			kind: "analysisFile",
			name: "report.tsv",
			storageKey: "analyses/9/0f1e2d3c4b5a69788796a5b4c3d2e1f0",
			format: "tsv",
			description: "The formatted report.",
		});

		expect(manifest.kind).toBe("analysisFile");
	});

	it("carries the storage key the workflow wrote to", () => {
		// The route records this verbatim after checking it against the resource's
		// own prefix, so it has to survive parsing byte for byte.
		const storageKey = "samples/4/0f1e2d3c4b5a69788796a5b4c3d2e1f0";

		const manifest = JobFileManifest.parse({
			kind: "sampleRead",
			name: "reads_1.fq.gz",
			storageKey,
		});

		expect(manifest.storageKey).toBe(storageKey);
	});

	it("rejects an entry with no storage key", () => {
		expect(
			JobFileManifest.safeParse({
				kind: "sampleRead",
				name: "reads_1.fq.gz",
			}).success,
		).toBe(false);
	});

	it("drops a size a runner tries to declare", () => {
		// The row is written with the byte count the route reads back from storage,
		// so a declared one is stripped here rather than reaching the data layer
		// and inviting a reader to wonder which of the two won.
		const manifest = JobFileManifest.parse({
			kind: "sampleRead",
			name: "reads_1.fq.gz",
			storageKey: "samples/4/0f1e2d3c4b5a69788796a5b4c3d2e1f0",
			size: 8_589_934_592,
		});

		expect(manifest).not.toHaveProperty("size");
	});
});
