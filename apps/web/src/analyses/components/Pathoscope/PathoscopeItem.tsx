import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import AnalysisValue from "@analyses/components/AnalysisValue";
import { toScientificNotation } from "@app/format";
import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@base/Accordion";
import Checkbox from "@base/Checkbox";
import type { PathoscopeHit } from "@virtool/contracts";
import type { MouseEvent } from "react";
import PathoscopeDetail from "./PathoscopeDetail";
import PathoscopeOtuCoverage from "./PathoscopeOtuCoverage";

type PathoscopeItemProps = {
	/** Whether the hit is selected */
	checked: boolean;

	/** Complete information for a pathoscope hit */
	hit: PathoscopeHit;

	/** The total number of reads mapped to any OTU during the analysis*/
	mappedCount: number;

	/** Callback to handle hit selection, receiving the checkbox click event */
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** Results for a single pathoscope analysis hit  */
export function PathoscopeItem({
	checked,
	mappedCount,
	hit,
	onSelect,
}: PathoscopeItemProps) {
	const { abbreviation, coverage, depth, maxDepth, name, pi, id, segments } =
		hit;
	const { search } = useAnalysisSearch();
	const showReads = search.reads;

	const piValue = showReads
		? Math.round(pi * mappedCount)
		: toScientificNotation(pi);

	return (
		<AccordionItem value={id}>
			{/* The checkbox sits in a column of its own rather than in the summary
			    row, so it holds the left of the item whether it is collapsed or
			    expanded, and the summary and the content share one column — which is
			    what lands the OTU's chart and its isolates' charts on the same left
			    edge. */}
			<div className="flex items-stretch bg-white">
				<div className="flex items-start pl-4 pt-2.5">
					<Checkbox
						ariaLabel={`Select ${name}`}
						checked={checked}
						id={`PathoscopeCheckbox${id}`}
						onClick={onSelect}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex flex-col gap-4 px-4 py-2.5">
						{/* Only the name is the trigger. The abbreviation is a column of
						    its own rather than a second line under the name, so it reads
						    across with the figures beside it; an OTU without one leaves the
						    column out entirely, and the figures stay put because the row is
						    aligned from the right.

						    The labels are in the list header rather than on each hit, so a
						    column is named once for the list instead of once per row;
						    assistive technology still gets them from each value. */}
						<div className="flex gap-4 items-start justify-between">
							<AccordionTrigger>
								<span className="font-semibold text-gray-900 truncate">
									{name}
								</span>
							</AccordionTrigger>
							<div className="flex gap-4 shrink-0">
								{abbreviation && (
									<AnalysisValue
										className="w-32"
										color="gray"
										hideLabel
										label="Abbreviation"
										value={abbreviation}
									/>
								)}
								<AnalysisValue
									color="green"
									hideLabel
									label={showReads ? "Reads" : "Weight"}
									value={piValue}
								/>
								<AnalysisValue
									color="red"
									hideLabel
									label="Depth"
									value={depth}
								/>
								<AnalysisValue
									color="blue"
									hideLabel
									label="Coverage"
									value={coverage.toFixed(3)}
								/>
							</div>
						</div>

						<PathoscopeOtuCoverage maxDepth={maxDepth} segments={segments} />
					</div>
					<AccordionContent>
						<PathoscopeDetail hit={hit} mappedCount={mappedCount} />
					</AccordionContent>
				</div>
			</div>
		</AccordionItem>
	);
}
