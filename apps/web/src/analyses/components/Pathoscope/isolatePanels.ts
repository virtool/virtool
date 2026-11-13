import { toThousand } from "@app/format";
import type {
	PathoscopeSegmentCoverage,
	PathoscopeSequence,
} from "@virtool/contracts";
import type { CoveragePanel } from "./coverage";

// A schema segment name identifies the panel across every isolate, so a
// matched sequence is labelled with that rather than its accession where one
// is declared — the accession and definition move into a popover instead,
// alongside every other detail the row doesn't have room for. A segment the
// schema left unnamed has nothing to label it with but the accession itself.
//
// An unmatched segment names the reason, and only the server can tell the two
// apart: `sequences` holds the hits alone, so an isolate that does not carry a
// segment looks exactly like one that carries it and was assigned no reads.
// `absentSegmentKeys` is the isolate's reference read against the OTU version
// the analysis saw. Anything not on it falls to "no reads", which holds whether
// or not the isolate carries the segment — so a length-inferred segment, whose
// membership is not knowable at all, is never claimed either way.
function labelOf(
	segment: PathoscopeSegmentCoverage,
	sequence: PathoscopeSequence | undefined,
	absentSegmentKeys: string[],
): string {
	if (sequence) {
		return segment.name ?? sequence.accession;
	}

	const name = segment.name ?? "Segment";

	return absentSegmentKeys.includes(segment.key)
		? `${name} · not in this isolate`
		: `${name} · no reads`;
}

/** An isolate's coverage panel, with the sequence it draws if it has one. */
export type IsolatePanel = Omit<CoveragePanel, "detail"> & {
	sequence: PathoscopeSequence | undefined;
};

/**
 * Lay an isolate's sequences out against the OTU's segments.
 *
 * The isolate is laid out against the OTU's segments rather than against its
 * own sequences, so every isolate's panels line up and a segment this one has
 * no sequence for leaves its panel empty instead of shifting the rest along.
 */
export function buildIsolatePanels(
	segments: PathoscopeSegmentCoverage[],
	sequences: PathoscopeSequence[],
	absentSegmentKeys: string[],
): IsolatePanel[] {
	return segments.map((segment) => {
		const sequence = sequences.find(
			(entry) => entry.segmentKey === segment.key,
		);

		return {
			align: sequence?.align ?? null,
			key: segment.key,
			label: labelOf(segment, sequence, absentSegmentKeys),
			length: segment.length,
			// The sequence's own length, not the segment's — which is the longest any
			// isolate gave it, and would attribute a length to a sequence that is not
			// there.
			lengthLabel: sequence ? `${toThousand(sequence.length)} nt` : "",
			sequence,
		};
	});
}
