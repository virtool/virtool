import type { OtuSegment, OtuSequence } from "@virtool/contracts";
import { sortBy } from "es-toolkit";

/**
 * A hook for sorting the sequences for the active isolate
 *
 * @param sequences - The active isolate sequences
 * @param segments - The segments associated with the OTU
 */
export default function sortSequencesBySegment(
	sequences: OtuSequence[],
	segments: OtuSegment[],
): OtuSequence[] {
	if (sequences) {
		const segmentNames = segments.map((s) => s.name);
		return sortBy(sequences, [
			(entry) => {
				const index = entry.segment ? segmentNames.indexOf(entry.segment) : -1;
				return index !== -1 ? index : segmentNames.length;
			},
		]);
	}

	return [];
}
