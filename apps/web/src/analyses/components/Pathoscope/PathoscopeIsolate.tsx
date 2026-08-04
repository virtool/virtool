import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import AnalysisValue from "@analyses/components/AnalysisValue";
import { toScientificNotation, toThousand } from "@app/format";
import type {
	PathoscopeSegmentCoverage,
	PathoscopeSequence as PathoscopeSequenceData,
} from "@virtool/contracts";
import PathoscopeCoverageChart, {
	type CoveragePanel,
} from "./PathoscopeCoverageChart";
import PathoscopeSequenceDetail from "./PathoscopeSequenceDetail";

const height = 60;

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
	sequence: PathoscopeSequenceData | undefined,
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

type PathoscopeIsolateProps = {
	/** The OTU segments the isolate declares no sequence for, hit or not */
	absentSegmentKeys: string[];

	coverage: number;
	depth: number;
	maxDepth: number;
	name: string;
	pi: number;
	reads: number;

	/** The OTU's segments, which the isolate's sequences are laid out against */
	segments: PathoscopeSegmentCoverage[];

	sequences: PathoscopeSequenceData[];
};

export default function PathoscopeIsolate({
	absentSegmentKeys,
	coverage,
	depth,
	maxDepth,
	name,
	pi,
	reads,
	segments,
	sequences,
}: PathoscopeIsolateProps) {
	const { search } = useAnalysisSearch();
	const showReads = search.reads;

	// The isolate is laid out against the OTU's segments rather than against its
	// own sequences, so every isolate's panels line up and a segment this one has
	// no sequence for leaves its panel empty instead of shifting the rest along.
	const panels: CoveragePanel[] = segments.map((segment) => {
		const sequence = sequences.find(
			(entry) => entry.segmentKey === segment.key,
		);

		return {
			align: sequence?.align ?? null,
			detail: sequence ? (
				<PathoscopeSequenceDetail sequence={sequence} />
			) : undefined,
			key: segment.key,
			label: labelOf(segment, sequence, absentSegmentKeys),
			length: segment.length,
			// The sequence's own length, not the segment's — which is the longest any
			// isolate gave it, and would attribute a length to a sequence that is not
			// there.
			lengthLabel: sequence ? `${toThousand(sequence.length)} nt` : "",
		};
	});

	const description =
		segments.length > 1
			? `Read depth across each of the ${segments.length} segments of the ${name} isolate`
			: `Read depth across the ${name} isolate`;

	return (
		<div className="mb-6">
			{/* The figures sit in the same fixed-width columns, in the same order, as
			    the OTU's own — every column is right-aligned against the same edge, so
			    an isolate's weight, depth and coverage read directly under the OTU's.
			    Their labels are only in the OTU's row, so they are not repeated down
			    the panel; assistive technology still gets them from each value. */}
			<div className="flex gap-4 items-start justify-between mb-2">
				<h4 className="font-medium m-0 min-w-0 text-gray-900 truncate">
					{name}
				</h4>
				<div className="flex gap-4 shrink-0">
					<AnalysisValue
						color="green"
						hideLabel
						label={showReads ? "Reads" : "Weight"}
						value={showReads ? reads : toScientificNotation(pi)}
					/>
					<AnalysisValue color="red" hideLabel label="Depth" value={depth} />
					<AnalysisValue
						color="blue"
						hideLabel
						label="Coverage"
						value={coverage.toFixed(3)}
					/>
				</div>
			</div>
			{panels.length > 0 && (
				<PathoscopeCoverageChart
					description={description}
					height={height}
					maxDepth={maxDepth}
					panels={panels}
				/>
			)}
		</div>
	);
}
