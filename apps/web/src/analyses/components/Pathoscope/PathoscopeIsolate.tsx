import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { toScientificNotation } from "@app/format";
import ScrollSync from "@base/ScrollSync";
import type { PathoscopeSequence as PathoscopeSequenceData } from "@virtool/contracts";
import PathoscopeSequence from "./PathoscopeSequence";

type PathoscopeIsolateProps = {
	coverage: number;
	depth: number;
	maxDepth: number;
	maxGenomeLength: number;
	name: string;
	pi: number;
	reads: number;
	sequences: PathoscopeSequenceData[];
};

export default function PathoscopeIsolate({
	coverage,
	depth,
	maxDepth,
	maxGenomeLength,
	name,
	pi,
	reads,
	sequences,
}: PathoscopeIsolateProps) {
	const { search } = useAnalysisSearch();
	const showReads = search.reads ?? false;

	const totalLength = sequences.reduce((acc, hit) => acc + hit.length, 0);

	const sequenceComponents = sequences.map((hit) => {
		let ratio = 1;

		if (sequences.length > 1) {
			ratio = hit.length / totalLength;
		}

		return (
			<PathoscopeSequence
				key={hit.accession}
				accession={hit.accession}
				data={hit.align}
				definition={hit.definition}
				maxGenomeLength={maxGenomeLength}
				id={hit.id}
				length={hit.length}
				ratio={ratio}
				yMax={maxDepth}
			/>
		);
	});

	return (
		<div className="mb-6 relative">
			<div className="flex gap-4 items-end mb-2 text-lg font-medium">
				{name}
				<div className="flex gap-2 text-base">
					<span className="text-green-700">
						{showReads ? reads : toScientificNotation(pi)}
					</span>
					<span className="text-red-700">{depth.toFixed(0)}</span>
					<span className="text-blue-700">
						{toScientificNotation(coverage)}
					</span>
				</div>
			</div>
			<ScrollSync className="flex gap-4">{sequenceComponents}</ScrollSync>
		</div>
	);
}
