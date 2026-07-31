import { toThousand } from "@app/format";
import type { PathoscopeSegmentCoverage } from "@virtool/contracts";
import PathoscopeCoverageChart, {
	type CoveragePanel,
} from "./PathoscopeCoverageChart";

const height = 80;

// A named segment is labelled with its name; one matched to its neighbours by
// length has nothing to be called, and its length — now in the caption's own
// right — is identity enough.
//
// A segment nothing mapped to draws no curve, so its label has to carry the
// reason. An empty panel on its own reads as a gap in the layout.
function labelOf(segment: PathoscopeSegmentCoverage): string {
	if (segment.detected) {
		return segment.name ?? "";
	}

	return segment.name ? `${segment.name} · no reads` : "No reads";
}

type OtuCoverageProps = {
	/** The greatest depth recorded on any nucleotide of the OTU */
	maxDepth: number;

	/** The OTU's genome segments, in the order they should be drawn */
	segments: PathoscopeSegmentCoverage[];
};

export default function PathoscopeOtuCoverage({
	maxDepth,
	segments,
}: OtuCoverageProps) {
	// A single-segment OTU is the unsegmented case, where a name would only repeat
	// what the accordion already says — but its length still gets drawn. An
	// undetected segment is named whatever the count, because it draws nothing and
	// a blank panel needs its reason.
	const labelled =
		segments.length > 1 || segments.some((segment) => !segment.detected);

	const description =
		segments.length > 1
			? `Read depth across each of the ${segments.length} segments of the reference genome`
			: "Read depth across the reference genome";

	const panels: CoveragePanel[] = segments.map((segment) => ({
		align: segment.align,
		key: segment.key,
		label: labelled ? labelOf(segment) : "",
		length: segment.length,
		lengthLabel: `${toThousand(segment.length)} nt`,
	}));

	return (
		<PathoscopeCoverageChart
			description={description}
			height={height}
			maxDepth={maxDepth}
			panels={panels}
		/>
	);
}
