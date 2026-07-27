import { useSortAndFilterPathoscopeHits } from "@analyses/hooks";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import Accordion from "@base/Accordion";
import type { Sample } from "@virtool/contracts";
import { PathoscopeItem } from "./PathoscopeItem";

type PathoscopeListProps = {
	analysis: FormattedPathoscopeAnalysis;
	sample: Sample;
};

/** A list of Pathoscope hits. */
export function PathoscopeList({ analysis, sample }: PathoscopeListProps) {
	const hits = useSortAndFilterPathoscopeHits(
		analysis,
		sample.quality?.length[1] ?? 0,
	);

	return (
		<Accordion type="single" collapsible>
			{hits.map((hit) => (
				<PathoscopeItem
					key={hit.id}
					hit={hit}
					mappedCount={analysis.results.readCount}
				/>
			))}
		</Accordion>
	);
}
