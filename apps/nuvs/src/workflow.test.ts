import { describe, expect, it } from "vitest";
import { nuvsWorkflow } from "./workflow";

/**
 * The step list, in order, with the display name each step resolves to.
 *
 * **Ids are a contract.** The jobs API stores them in the `jobs.steps` column
 * and `POST /jobs/{jobId}/steps/{stepId}/start` takes them, and the UI renders
 * them, so renaming one changes what users see — on jobs already written as
 * well as new ones. Renaming one is not a refactor.
 */
const EXPECTED_STEPS = [
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

	it("declares its ten step ids, in order", () => {
		expect(nuvsWorkflow.steps.map(({ id }) => id)).toEqual(
			EXPECTED_STEPS.map(([id]) => id),
		);
	});

	// Four steps carry an explicit name because title-casing the id would give
	// `Create Reference Fasta`, `Otus` and `Vfam`. The rest are left to derive.
	it("resolves each step's display name", () => {
		expect(nuvsWorkflow.steps.map(({ name }) => name)).toEqual(
			EXPECTED_STEPS.map(([, name]) => name),
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
