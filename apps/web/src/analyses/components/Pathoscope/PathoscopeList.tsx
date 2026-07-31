import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { useSortAndFilterPathoscopeHits } from "@analyses/hooks";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { writeToClipboard } from "@app/clipboard";
import Accordion from "@base/Accordion";
import { useListSelection } from "@base/useListSelection";
import type { PathoscopeHit } from "@virtool/contracts";
import type { MouseEvent } from "react";
import { PathoscopeItem } from "./PathoscopeItem";
import PathoscopeListHeader from "./PathoscopeListHeader";
import PathoscopeTable from "./PathoscopeTable";
import { formatPathoscopeHitsAsTsv } from "./table";

type PathoscopeListProps = {
	analysis: FormattedPathoscopeAnalysis;
};

/** A list of Pathoscope hits. */
export function PathoscopeList({ analysis }: PathoscopeListProps) {
	const hits = useSortAndFilterPathoscopeHits(analysis);

	const { search } = useAnalysisSearch();
	const showReads = search.reads;
	const showTable = search.table;

	// Every hit is on screen at once, so a selection that outlived a filter would
	// be copied without ever being visible. The key is built from the hit ids
	// sorted, so narrowing the list clears the selection while merely re-sorting
	// it — which changes the order but not the membership — leaves it alone.
	const selection = useListSelection<PathoscopeHit>({
		getKey: (hit) => hit.id,
		resetKey: hits
			.map((hit) => hit.id)
			.sort()
			.join(","),
	});

	function selectHit(hit: PathoscopeHit, event: MouseEvent<HTMLButtonElement>) {
		selection.select(hit, {
			shiftKey: event.shiftKey,
			visibleItems: hits,
		});
	}

	// Taken from the hits rather than the selection so the pasted rows come out
	// in the order they are shown, not the order they were clicked.
	function copySelected() {
		return writeToClipboard(
			formatPathoscopeHitsAsTsv(hits.filter(selection.isSelected), {
				headers: true,
				mappedCount: analysis.results.readCount,
				showReads,
			}),
		);
	}

	return (
		<>
			{/* One header for both views: they draw the same columns in the same
			    places, and differ only in whether a coverage chart is drawn under
			    each hit. Labelling a column no hit fills would put a heading over
			    empty space, so the header is told whether there is one to label. */}
			<PathoscopeListHeader
				checked={selection.getVisibleState(hits)}
				found={hits.length}
				onCopy={copySelected}
				onSelectAll={() => selection.toggleVisible(hits)}
				selectedCount={selection.selected.length}
				showAbbreviation={hits.some((hit) => Boolean(hit.abbreviation))}
				total={analysis.results.hits.length}
			/>
			{showTable ? (
				<PathoscopeTable
					hits={hits}
					isSelected={selection.isSelected}
					mappedCount={analysis.results.readCount}
					onSelect={selectHit}
				/>
			) : (
				<Accordion type="single" collapsible>
					{hits.map((hit) => (
						<PathoscopeItem
							key={hit.id}
							checked={selection.isSelected(hit)}
							hit={hit}
							mappedCount={analysis.results.readCount}
							onSelect={(event: MouseEvent<HTMLButtonElement>) =>
								selectHit(hit, event)
							}
						/>
					))}
				</Accordion>
			)}
		</>
	);
}
