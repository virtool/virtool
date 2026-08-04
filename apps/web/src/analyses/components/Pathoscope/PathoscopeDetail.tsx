import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import type { PathoscopeHit } from "@virtool/contracts";
import PathoscopeIsolate from "./PathoscopeIsolate";

type PathoscopeDetailProps = {
	/** Complete information for a pathoscope hit */
	hit: PathoscopeHit;

	/** The total number of reads mapped to any OTU during the analysis*/
	mappedCount: number;
};

/** Detailed coverage for a single OTU hits from pathoscope analysis */
export default function PathoscopeDetail({
	hit,
	mappedCount,
}: PathoscopeDetailProps) {
	const {
		search: { minCoverage, showLowIsolates },
	} = useAnalysisSearch();

	const { isolates, segments } = hit;

	// The same cutoff the OTU list is held to, against each isolate's own
	// coverage. The rule this replaced kept an isolate carrying at least 3% of
	// its OTU's weight, which said nothing about how much of it was covered —
	// and scaled with the parent, so the same isolate survived under a weak OTU
	// and was dropped under a strong one.
	const filtered = isolates.filter(
		(isolate) => showLowIsolates || isolate.coverage >= minCoverage,
	);

	const isolateComponents = filtered.map((isolate) => {
		return (
			<PathoscopeIsolate
				key={isolate.id}
				absentSegmentKeys={isolate.absentSegmentKeys}
				coverage={isolate.coverage}
				depth={isolate.depth}
				maxDepth={hit.maxDepth}
				name={isolate.name}
				pi={isolate.pi}
				reads={Math.round(isolate.pi * mappedCount)}
				segments={segments}
				sequences={isolate.sequences}
			/>
		);
	});

	return <div className="pt-4">{isolateComponents}</div>;
}
