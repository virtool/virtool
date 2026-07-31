import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import AnalysisValue from "@analyses/components/AnalysisValue";
import { toScientificNotation } from "@app/format";
import Checkbox from "@base/Checkbox";
import type { PathoscopeHit } from "@virtool/contracts";
import type { MouseEvent } from "react";

type PathoscopeTableProps = {
	/** The hits to show, in display order */
	hits: PathoscopeHit[];

	/** Whether a hit is selected */
	isSelected: (hit: PathoscopeHit) => boolean;

	/** The total number of reads mapped to any OTU during the analysis */
	mappedCount: number;

	/** Callback to handle hit selection, receiving the checkbox click event */
	onSelect: (hit: PathoscopeHit, event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * The pathoscope hits as plain rows of figures, with no coverage charts.
 *
 * Not a `<table>`: the figures sit in the same fixed-width columns as the chart
 * view's, so the list header labels both, and each figure carries its own label
 * for assistive technology. A real table would need column headers of its own,
 * which is the one thing this view exists to do without.
 *
 * The rows are tighter than the chart view's — no chart to leave room for, and
 * one rule between rows rather than a border around each — but every column
 * starts and ends at the same place, so switching views moves nothing sideways.
 */
export default function PathoscopeTable({
	hits,
	isSelected,
	mappedCount,
	onSelect,
}: PathoscopeTableProps) {
	const { search } = useAnalysisSearch();
	const showReads = search.reads;

	return (
		<ul className="border border-gray-300 rounded-sm bg-white">
			{hits.map((hit) => (
				<li
					className="flex items-center border-t border-gray-200 first:border-t-0"
					key={hit.id}
				>
					<div className="flex items-center pl-4">
						<Checkbox
							ariaLabel={`Select ${hit.name}`}
							checked={isSelected(hit)}
							id={`PathoscopeTableCheckbox${hit.id}`}
							onClick={(event) => onSelect(hit, event)}
						/>
					</div>
					<div className="flex flex-1 min-w-0 gap-4 items-center justify-between px-4 py-2.5">
						<span className="font-semibold text-gray-900 truncate">
							{hit.name}
						</span>
						<div className="flex gap-4 shrink-0">
							{hit.abbreviation && (
								<AnalysisValue
									className="w-32"
									color="gray"
									hideLabel
									label="Abbreviation"
									value={hit.abbreviation}
								/>
							)}
							<AnalysisValue
								color="green"
								hideLabel
								label={showReads ? "Reads" : "Weight"}
								value={
									showReads
										? Math.round(hit.pi * mappedCount)
										: toScientificNotation(hit.pi)
								}
							/>
							<AnalysisValue
								color="red"
								hideLabel
								label="Depth"
								value={hit.depth}
							/>
							<AnalysisValue
								color="blue"
								hideLabel
								label="Coverage"
								value={hit.coverage.toFixed(3)}
							/>
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}
