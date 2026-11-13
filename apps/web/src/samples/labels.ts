import type { SampleLabel } from "@samples/queries";
import type { SampleMinimal } from "@virtool/contracts";
import { groupBy, union } from "es-toolkit";

/**
 * Normalizes a label color, which may or may not carry a leading ``#``.
 */
export function getHexColor(color: string): string {
	return color.startsWith("#") ? color : `#${color}`;
}

/**
 * Collapses the labels of the selected samples into one list, noting for each
 * whether every selected sample carries it.
 */
export function getSelectedLabels(samples: SampleMinimal[]): SampleLabel[] {
	const allLabels = samples.flatMap((sample) => sample.labels);
	const grouped = groupBy(allLabels, (label) => label.id);

	return Object.values(grouped).flatMap((labels) => {
		const [first] = labels;

		if (!first) {
			return [];
		}

		return [{ ...first, allLabeled: labels.length === samples.length }];
	});
}

/**
 * The label ids each selected sample carries once a label is toggled across
 * the selection.
 *
 * The label is removed when every selected sample already carries it, and added
 * otherwise.
 */
export function getToggledLabels(
	selectedLabels: SampleLabel[],
	samples: SampleMinimal[],
	labelId: number,
): { sampleId: number; labels: number[] }[] {
	const allLabeled =
		selectedLabels.find((label) => label.id === labelId)?.allLabeled === true;

	return samples.map((sample) => {
		const labelIds = sample.labels.map((label) => label.id);

		return {
			sampleId: sample.id,
			labels: allLabeled
				? labelIds.filter((id) => id !== labelId)
				: union(labelIds, [labelId]),
		};
	});
}
