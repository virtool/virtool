import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { DEFAULT_SORT_KEY } from "@analyses/search";
import ButtonToggle from "@base/ButtonToggle";
import SearchToolbar from "@base/SearchToolbar";
import Tooltip from "@base/Tooltip";
import { AnalysisViewerSort } from "../Viewer/Sort";
import NuvsExport, { type NuvsExportProps } from "./NuvsExport";

/**
 * Displays a toolbar for managing and filtering Nuvs
 */
export default function NuvsToolbar({
	analysisId,
	results,
	sampleName,
}: NuvsExportProps) {
	const { search, setSearch } = useAnalysisSearch();
	const { find, showUnhitOrfs, showUnhitSequences } = search;
	const sortKey = search.sort ?? DEFAULT_SORT_KEY.nuvs;

	return (
		<SearchToolbar
			aria-label="Search results"
			onChange={(find) => setSearch({ find })}
			placeholder="Name or family"
			value={find}
		>
			<AnalysisViewerSort
				workflow="nuvs"
				sortKey={sortKey}
				onSelect={(sort) => setSearch({ sort })}
			/>
			<Tooltip tip="Hide sequences that have no HMM hits">
				<ButtonToggle
					onPressedChange={(pressed) =>
						setSearch({ showUnhitSequences: !pressed })
					}
					pressed={!showUnhitSequences}
				>
					Filter Sequences
				</ButtonToggle>
			</Tooltip>
			<Tooltip tip="Hide ORFs that have no HMM hits">
				<ButtonToggle
					pressed={!showUnhitOrfs}
					onPressedChange={(pressed) => setSearch({ showUnhitOrfs: !pressed })}
				>
					Filter ORFs
				</ButtonToggle>
			</Tooltip>
			<NuvsExport
				analysisId={analysisId}
				results={results}
				sampleName={sampleName}
			/>
		</SearchToolbar>
	);
}
