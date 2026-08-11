import { describe, expect, it } from "vitest";
import { nuvsWorkflow } from "./workflow";

/**
 * The step list, exactly as Python declares it.
 *
 * **Ids are the cutover contract.** The jobs API stores them and
 * `POST /jobs/{jobId}/steps/{stepId}/start` takes them, so an id that does not
 * match the Python function it was ported from changes the shape of a job's step
 * list — and a job claimed by one implementation and read by the other would
 * disagree about which step it is on. Renaming one is not a refactor.
 */
const PYTHON_STEPS = [
	["create_reference_fasta", "Create reference FASTA"],
	["trim_reads", "Trim Reads"],
	["create_reference_index", "Create reference index"],
	["eliminate_otus", "Eliminate OTUs"],
	["create_subtraction_indexes", "Create subtraction indexes"],
	["eliminate_subtraction", "Eliminate Subtraction"],
	["reunite_pairs", "Reunite Pairs"],
	["assemble", "Assemble"],
	["process_assembly", "Process Assembly"],
	["vfam", "VFam"],
];

describe("nuvsWorkflow", () => {
	it("declares itself as nuvs", () => {
		expect(nuvsWorkflow.name).toBe("nuvs");
	});

	it("declares Python's ten steps, in Python's order", () => {
		expect(nuvsWorkflow.steps.map(({ id }) => id)).toEqual(
			PYTHON_STEPS.map(([id]) => id),
		);
	});

	// Four steps carry an explicit name because title-casing the id would give
	// `Create Reference Fasta`, `Otus` and `Vfam`. The rest are left to derive.
	it("resolves each step's display name", () => {
		expect(nuvsWorkflow.steps.map(({ name }) => name)).toEqual(
			PYTHON_STEPS.map(([, name]) => name),
		);
	});

	it("gives every step a description", () => {
		for (const step of nuvsWorkflow.steps) {
			expect(step.description.trim()).not.toBe("");
		}
	});

	// Pathoscope's whole output is `results`; NuVs writes three files, and the
	// manifest declaring them rides on the same finalize call. That call is made
	// by `vfam` rather than derived from state, so the definition declares no
	// `result`.
	it("finalizes from its last step rather than through a result deriver", () => {
		expect(nuvsWorkflow.result).toBeUndefined();
	});
});
