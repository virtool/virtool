import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import AnalysisValue from "@analyses/components/AnalysisValue";
import { toScientificNotation } from "@app/format";
import type {
	PathoscopeSegmentCoverage,
	PathoscopeSequence as PathoscopeSequenceData,
} from "@virtool/contracts";
import type { CoveragePanel } from "./coverage";
import { buildIsolatePanels } from "./isolatePanels";
import PathoscopeCoverageChart from "./PathoscopeCoverageChart";
import PathoscopeSequenceDetail from "./PathoscopeSequenceDetail";

const height = 60;

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
	const panels: CoveragePanel[] = buildIsolatePanels(
		segments,
		sequences,
		absentSegmentKeys,
	).map(({ sequence, ...panel }) => ({
		...panel,
		detail: sequence ? (
			<PathoscopeSequenceDetail sequence={sequence} />
		) : undefined,
	}));

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
