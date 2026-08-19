import { describe, expect, it } from "vitest";
import { createSubtractionWorkflow } from "./workflow";

/**
 * The step list, exactly as this workflow declares it.
 *
 * **Ids are a contract.** They are stored in the `jobs.steps` column, rendered
 * by the UI, and taken by `POST /jobs/{jobId}/steps/{stepId}/start`, so
 * renaming one changes what users see. There is deliberately no `build_index`
 * step: nothing consumes a subtraction's bowtie2 shards and the finalize route
 * accepts the genome alone.
 */
const STEPS = [
	["compute_gc_and_count", "Compute GC and Count"],
	["finalize", "Finalize"],
];

describe("createSubtractionWorkflow", () => {
	it("declares itself as create_subtraction", () => {
		expect(createSubtractionWorkflow.name).toBe("create_subtraction");
	});

	it("declares the two steps, in order", () => {
		expect(createSubtractionWorkflow.steps.map(({ id }) => id)).toEqual(
			STEPS.map(([id]) => id),
		);
	});

	// `compute_gc_and_count` carries an explicit name because title-casing the id
	// would give `Compute Gc And Count`. `finalize` is left to derive.
	it("resolves each step's display name", () => {
		expect(createSubtractionWorkflow.steps.map(({ name }) => name)).toEqual(
			STEPS.map(([, name]) => name),
		);
	});

	it("gives every step a description", () => {
		for (const step of createSubtractionWorkflow.steps) {
			expect(step.description.trim()).not.toBe("");
		}
	});

	/**
	 * There is deliberately no delete on failure: a failed run leaves an
	 * unfinalized subtraction for the user to delete. `finalize` makes the
	 * finalize call itself rather than deriving a payload from state.
	 */
	it("declares no result payload, as a subtraction is not an analysis", () => {
		expect(createSubtractionWorkflow.result).toBeUndefined();
	});
});
