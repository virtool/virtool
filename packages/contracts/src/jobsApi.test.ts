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
	const STARTED_AT = "2026-07-31T16:38:58.852Z";

	const step: JobStep = {
		id: "map_subtractions",
		name: "Map subtractions",
		description: "Eliminate reads that map to a subtraction.",
		startedAt: new Date(STARTED_AT),
	};

	// The wire carries a `Date` and the column carries the ISO string Python
	// wrote, so this pair is the only place the two spellings meet. Both halves
	// matter: a `Date` reaching the column would be stored as an object Python
	// cannot read, and a string reaching the wire would arrive as a string every
	// caller has to remember to parse.
	it("persists startedAt as an ISO string under started_at, and back as a Date", () => {
		const stored = toStoredJobStep(JobStep.parse(step));

		expect(stored.started_at).toBe(STARTED_AT);
		expect(stored).not.toHaveProperty("startedAt");

		const roundTripped = fromStoredJobStep(
			StoredJobStep.parse(JSON.parse(JSON.stringify(stored))),
		);

		expect(roundTripped).toStrictEqual(step);
		expect(roundTripped.startedAt).toBeInstanceOf(Date);
	});

	it("carries a null startedAt through unstarted", () => {
		const unstarted = { ...step, startedAt: null };

		expect(fromStoredJobStep(toStoredJobStep(unstarted))).toStrictEqual(
			unstarted,
		);
	});
});

// JSON has no date type, so what actually crosses is a string either way. These
// pin that the encoding is unchanged while the parsed type is not.
describe("timestamps", () => {
	const CREATED_AT = "2026-07-31T16:30:00.000Z";

	function job(overrides: Record<string, unknown> = {}) {
		return {
			id: 1,
			args: {},
			claim: null,
			claimedAt: null,
			createdAt: CREATED_AT,
			pingedAt: null,
			progress: 0,
			state: "pending",
			steps: null,
			user: { id: 3, handle: "igboyes" },
			workflow: "create_sample",
			...overrides,
		};
	}

	it("parses the string the wire carries into a Date", () => {
		const parsed = Job.parse(job());

		expect(parsed.createdAt).toBeInstanceOf(Date);
		expect(parsed.createdAt.toISOString()).toBe(CREATED_AT);
	});

	// The handler hands `Response.json` the `Date` it read out of Postgres, and
	// `JSON.stringify` calls `Date.prototype.toJSON`. Python reads these bytes,
	// so they must not have moved.
	it("encodes back to the same ISO string it arrived as", () => {
		const encoded = JSON.parse(JSON.stringify(Job.parse(job())));

		expect(encoded.createdAt).toBe(CREATED_AT);
	});

	it("passes a Date through unchanged, so one schema types both directions", () => {
		const parsed = Job.parse(job({ createdAt: new Date(CREATED_AT) }));

		expect(parsed.createdAt.toISOString()).toBe(CREATED_AT);
	});

	it("keeps a null timestamp null rather than coercing it to the epoch", () => {
		// `new Date(null)` is the epoch, not an invalid date, so a nullable field
		// that let `coerce` see the null would silently report 1970.
		expect(Job.parse(job({ pingedAt: null })).pingedAt).toBeNull();
	});

	// `coerce` runs `new Date(value)`, which answers `Invalid Date` rather than
	// throwing. Without the refinement this parses and surfaces as `NaN` much
	// later in a run.
	it.each(["not-a-date", "", "2026-13-45T99:99:99Z"])(
		"rejects %j rather than parsing it as an invalid date",
		(value) => {
			expect(Job.safeParse(job({ createdAt: value })).success).toBe(false);
		},
	);
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
