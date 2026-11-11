import { getSelectedLabels, getToggledLabels } from "@samples/labels";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import { describe, expect, it } from "vitest";

const testLabel = { color: "#C4B5FD", description: "", id: 1, name: "test" };
const label = { color: "#FCA5A5", description: "", id: 2, name: "label" };

// "test" is on both samples and "label" is on one only, so the selection has
// labels in mixed states.
const samples = [
	createFakeSampleMinimal({ id: 1, labels: [testLabel, label] }),
	createFakeSampleMinimal({ id: 2, labels: [testLabel] }),
];

describe("getSelectedLabels()", () => {
	it("should note which labels every selected sample carries", () => {
		expect(getSelectedLabels(samples)).toEqual([
			{ ...testLabel, allLabeled: true },
			{ ...label, allLabeled: false },
		]);
	});

	it("should return no labels for an empty selection", () => {
		expect(getSelectedLabels([])).toEqual([]);
	});
});

describe("getToggledLabels()", () => {
	it.each([
		[
			"remove a fully-applied label from every sample",
			1,
			[
				{ sampleId: 1, labels: [2] },
				{ sampleId: 2, labels: [] },
			],
		],
		[
			"add a partially-applied label to every sample",
			2,
			[
				{ sampleId: 1, labels: [1, 2] },
				{ sampleId: 2, labels: [1, 2] },
			],
		],
		[
			"add an unapplied label to every sample",
			3,
			[
				{ sampleId: 1, labels: [1, 2, 3] },
				{ sampleId: 2, labels: [1, 3] },
			],
		],
	])("should %s", (_, labelId, expected) => {
		expect(
			getToggledLabels(getSelectedLabels(samples), samples, labelId),
		).toEqual(expected);
	});
});
