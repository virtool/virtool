import { describe, expect, it } from "vitest";
import { createSubtractionWorkflow } from "./workflow";

/**
 * The step list, exactly as Python declares it.
 *
 * **Ids are the cutover contract.** The jobs API stores them and
 * `POST /jobs/{jobId}/steps/{stepId}/start` takes them, so an id that does not
 * match the Python function it was ported from changes the shape of a job's step
 * list. Python's `build_index` is deliberately absent: nothing consumes a
 * subtraction's bowtie2 shards and the finalize route accepts the genome alone.
 */
const PYTHON_STEPS = [
	["compute_gc_and_count", "Compute GC and Count"],
	["finalize", "Finalize"],
];

describe("createSubtractionWorkflow", () => {
	it("declares itself as create_subtraction", () => {
		expect(createSubtractionWorkflow.name).toBe("create_subtraction");
	});

	it("declares Python's two steps, in Python's order", () => {
		expect(createSubtractionWorkflow.steps.map(({ id }) => id)).toEqual(
			PYTHON_STEPS.map(([id]) => id),
		);
	});

	// `compute_gc_and_count` carries an explicit name because title-casing the id
	// would give `Compute Gc And Count`. `finalize` is left to derive.
	it("resolves each step's display name", () => {
		expect(createSubtractionWorkflow.steps.map(({ name }) => name)).toEqual(
			PYTHON_STEPS.map(([, name]) => name),
		);
	});

	it("gives every step a description", () => {
		for (const step of createSubtractionWorkflow.steps) {
			expect(step.description.trim()).not.toBe("");
		}
	});

	/**
	 * Python registers an `@hooks.on_failure` that issues
	 * `DELETE /subtractions/{id}`. It is deliberately not ported: a failed run
	 * leaves an unfinalized subtraction for the user to delete. `finalize` makes
	 * the finalize call itself rather than deriving a payload from state.
	 */
	it("declares no result payload, as a subtraction is not an analysis", () => {
		expect(createSubtractionWorkflow.result).toBeUndefined();
	});
});
