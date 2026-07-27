import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import AnalysisValue from "@analyses/components/AnalysisValue";
import { toScientificNotation } from "@app/format";
import AccordionContent from "@base/AccordionContent";
import AccordionScrollingItem from "@base/AccordionScrollingItem";
import AccordionTrigger from "@base/AccordionTrigger";
import type { PathoscopeHit } from "@virtool/contracts";
import PathoscopeDetail from "./PathoscopeDetail";
import PathoscopeOtuCoverage from "./PathoscopeOtuCoverage";

type PathoscopeItemProps = {
	/** Complete information for a pathoscope hit */
	hit: PathoscopeHit;

	/** The total number of reads mapped to any OTU during the analysis*/
	mappedCount: number;
};

/** Results for a single pathoscope analysis hit  */
export function PathoscopeItem({ mappedCount, hit }: PathoscopeItemProps) {
	const {
		abbreviation,
		align,
		coverage,
		depth,
		maxGenomeLength,
		name,
		pi,
		id,
	} = hit;
	const { search } = useAnalysisSearch();
	const showReads = search.reads ?? false;

	const piValue = showReads
		? Math.round(pi * mappedCount)
		: toScientificNotation(pi);

	return (
		<AccordionScrollingItem value={id}>
			<AccordionTrigger className="flex-col items-stretch gap-4">
				<div className="flex justify-between">
					<header className="flex flex-col font-medium items-start text-lg">
						<span className="mb-0.5">{name}</span>
						<span className="text-gray-500">
							{abbreviation || "No Abbreviation"}
						</span>
					</header>
					<div className="flex gap-4">
						<AnalysisValue
							color="green"
							label={showReads ? "READS" : "WEIGHT"}
							value={piValue}
						/>
						<AnalysisValue color="red" label="DEPTH" value={depth} />
						<AnalysisValue
							color="blue"
							label="COVERAGE"
							value={coverage.toFixed(3)}
						/>
					</div>
				</div>

				<PathoscopeOtuCoverage align={align} length={maxGenomeLength} />
			</AccordionTrigger>
			<AccordionContent>
				<PathoscopeDetail hit={hit} mappedCount={mappedCount} />
			</AccordionContent>
		</AccordionScrollingItem>
	);
}
