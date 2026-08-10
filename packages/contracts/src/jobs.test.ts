import { describe, expect, it } from "vitest";
import {
	computeJobProgress,
	fromStoredJobClaim,
	fromStoredJobStep,
	isJobStateUnsuccessful,
	Job,
	JobClaim,
	JobStep,
	StoredJobClaim,
	StoredJobStep,
	toStoredJobClaim,
	toStoredJobStep,
} from "./jobs";

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
describe("Job timestamps", () => {
	const CREATED_AT = "2026-07-31T16:30:00.000Z";

	function job(overrides: Record<string, unknown> = {}) {
		return {
			id: 1,
			args: {},
			claim: null,
			claimedAt: null,
			createdAt: CREATED_AT,
			finishedAt: null,
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
		expect(Job.parse(job({ finishedAt: null })).finishedAt).toBeNull();
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

describe("Job", () => {
	const base = {
		id: 1,
		args: {},
		claim: null,
		claimedAt: null,
		createdAt: "2026-07-31T16:30:00.000Z",
		finishedAt: null,
		progress: 0,
		state: "pending",
		steps: null,
		user: { id: 3, handle: "igboyes" },
		workflow: "create_sample",
	};

	it("accepts a build_index job on the read path", () => {
		// `build_index` stays Python-owned and is never handed out at claim time,
		// but its rows exist and must still parse.
		expect(Job.safeParse({ ...base, workflow: "build_index" }).success).toBe(
			true,
		);
	});

	it("reads args as a map of stringified ids", () => {
		// `jobs` has no `args` column: the map is recomposed from the resources
		// that reference the job, and every value is an id run through `String`.
		expect(Job.parse({ ...base, args: { sample_id: "4" } }).args).toStrictEqual(
			{
				sample_id: "4",
			},
		);
	});

	it("rejects an arg value that is not a string", () => {
		expect(Job.safeParse({ ...base, args: { sample_id: 4 } }).success).toBe(
			false,
		);
	});

	// One shape serves the SPA and the workflow runtime. A runner reading an
	// older build's response must not trip over a field it does not name.
	it("strips an unknown field rather than refusing the response", () => {
		const parsed = Job.parse({ ...base, pingedAt: "2026-07-31T16:31:00.000Z" });

		expect(parsed).not.toHaveProperty("pingedAt");
	});
});

describe("isJobStateUnsuccessful()", () => {
	it.each(["cancelled", "failed"])("is true for %s", (state) => {
		expect(isJobStateUnsuccessful(state)).toBe(true);
	});

	// Narrower than terminal on purpose: a succeeded job produced its resource.
	it.each(["pending", "running", "succeeded"])("is false for %s", (state) => {
		expect(isJobStateUnsuccessful(state)).toBe(false);
	});

	it("is false when the state is missing", () => {
		expect(isJobStateUnsuccessful(undefined)).toBe(false);
		expect(isJobStateUnsuccessful(null)).toBe(false);
	});
});

describe("computeJobProgress()", () => {
	function step(id: string, started: boolean): StoredJobStep {
		return {
			id,
			name: id,
			description: id,
			started_at: started ? "2026-07-31T16:38:58.852Z" : null,
		};
	}

	it.each(["cancelled", "failed", "succeeded"])("is 100 for %s", (state) => {
		expect(computeJobProgress(state, [step("one", false)])).toBe(100);
	});

	it("is the floored fraction of started steps while running", () => {
		const steps = [step("one", true), step("two", false), step("three", false)];

		expect(computeJobProgress("running", steps)).toBe(33);
	});

	it("is 0 for a pending job, a job with no steps, and a job with none", () => {
		expect(computeJobProgress("pending", [step("one", true)])).toBe(0);
		expect(computeJobProgress("running", [])).toBe(0);
		expect(computeJobProgress(null, null)).toBe(0);
	});
});
