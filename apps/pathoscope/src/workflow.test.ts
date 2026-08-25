import { describe, expect, it } from "vitest";
import { pathoscopeWorkflow } from "./workflow";

describe("pathoscopeWorkflow", () => {
	it("declares representative mapping as the candidate-screen step", () => {
		expect(pathoscopeWorkflow.steps.map(({ id }) => id)).toEqual([
			"create_representative_index",
			"create_subtraction_index",
			"map_representatives",
			"collapse_reference",
			"build_candidate_otu_index",
			"map_isolates",
			"eliminate_subtraction",
			"reassignment",
		]);
	});

	it("distinguishes screening reduction from isolate deduplication", () => {
		expect(
			pathoscopeWorkflow.steps
				.filter(({ id }) =>
					["create_representative_index", "collapse_reference"].includes(id),
				)
				.map(({ description, id, name }) => ({ description, id, name })),
		).toEqual([
			{
				description:
					"Select a small set of reference sequences for quickly finding possible viruses.",
				id: "create_representative_index",
				name: "Prepare Screening Reference",
			},
			{
				description:
					"Remove nearly identical virus isolates before detailed read matching.",
				id: "collapse_reference",
				name: "Remove Redundant Isolates",
			},
		]);
	});
});
