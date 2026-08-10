import { describe, expect, it } from "vitest";
import {
	fromStoredJobClaim,
	fromStoredJobStep,
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
