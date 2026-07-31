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
// An unmatched segment names the reason: distinct from the OTU-wide "no
// reads", so this isolate reads as lacking the segment rather than the
// segment being absent everywhere.
function labelOf(
	segment: PathoscopeSegmentCoverage,
	sequence: PathoscopeSequenceData | undefined,
): string {
	if (sequence) {
		return segment.name ?? sequence.accession;
	}

	const name = segment.name ?? "Segment";

	return segment.detected
		? `${name} · not in this isolate`
		: `${name} · no reads`;
}

type PathoscopeIsolateProps = {
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
			label: labelOf(segment, sequence),
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
