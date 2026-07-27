import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import ScrollSyncContainer from "@base/ScrollSyncContainer";
import type { PathoscopeHit } from "@virtool/contracts";
import { maxBy } from "es-toolkit";
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
	const { search } = useAnalysisSearch();
	const filterIsolates = search.filterIsolates ?? true;

	const { isolates, pi } = hit;

	const filtered = isolates.filter(
		(isolate) => !filterIsolates || isolate.pi >= 0.03 * pi,
	);

	const maxGenomeLength = maxBy(filtered, (item) => item.length)?.length;

	const isolateComponents = filtered.map((isolate) => {
		return (
			<PathoscopeIsolate
				key={isolate.id}
				coverage={isolate.coverage}
				depth={isolate.depth}
				maxDepth={hit.maxDepth}
				maxGenomeLength={maxGenomeLength ?? 0}
				name={isolate.name}
				pi={isolate.pi}
				reads={Math.round(isolate.pi * mappedCount)}
				sequences={isolate.sequences}
			/>
		);
	});

	return (
		<div className="pt-4">
			<ScrollSyncContainer>{isolateComponents}</ScrollSyncContainer>
		</div>
	);
}
