import type { SampleLabel } from "@samples/queries";
import type { SampleMinimal } from "@virtool/contracts";
import { groupBy } from "es-toolkit";

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
