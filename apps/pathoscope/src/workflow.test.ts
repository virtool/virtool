import { describe, expect, it } from "vitest";
import { pathoscopeWorkflow } from "./workflow";

describe("pathoscopeWorkflow", () => {
	it("declares representative mapping as the candidate-screen step", () => {
		expect(pathoscopeWorkflow.steps.map(({ id }) => id)).toEqual([
			"collapse_reference",
			"create_representative_index",
			"create_subtraction_index",
			"map_representatives",
			"build_candidate_otu_index",
			"map_isolates",
			"eliminate_subtraction",
			"reassignment",
		]);
	});
});
