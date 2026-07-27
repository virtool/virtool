import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import ButtonToggle from "@base/ButtonToggle";
import Dropdown from "@base/Dropdown";
import DropdownButton from "@base/DropdownButton";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuDownload from "@base/DropdownMenuDownload";
import Icon from "@base/Icon";
import SearchToolbar from "@base/SearchToolbar";
import Tooltip from "@base/Tooltip";
import {
	ArrowDownWideNarrow,
	ArrowUpWideNarrow,
	ChevronDown,
	File,
	FileDown,
} from "lucide-react";
import { AnalysisViewerSort } from "../Viewer/Sort";

type PathoscopeToolbarProps = {
	/** The unique identifier the analysis being viewed */
	analysisId: number;
};

/** A selection of filters and toggles for pathoscope data presentation */
export function PathoscopeToolbar({ analysisId }: PathoscopeToolbarProps) {
	const { search, setSearch } = useAnalysisSearch();
	const filterOtus = search.filterOtus ?? true;
	const filterIsolates = search.filterIsolates ?? true;
	const find = search.find ?? "";
	const showReads = search.reads ?? false;
	const sortKey = search.sort ?? "coverage";
	const sortDesc = search.sortDesc ?? true;

	return (
		<SearchToolbar
			aria-label="Search results"
			onChange={(find) => setSearch({ find })}
			value={find}
		>
			<AnalysisViewerSort
				workflow="pathoscope"
				sortKey={sortKey}
				onSelect={(sort) => setSearch({ sort })}
			/>
			<ButtonToggle
				onPressedChange={(sortDesc) => setSearch({ sortDesc })}
				pressed={Boolean(sortDesc)}
			>
				<Icon icon={sortDesc ? ArrowDownWideNarrow : ArrowUpWideNarrow} />
			</ButtonToggle>
			<Tooltip tip="Show read pseudo-counts instead of weight">
				<ButtonToggle
					onPressedChange={(reads) => setSearch({ reads })}
					pressed={Boolean(showReads)}
				>
					Show Reads
				</ButtonToggle>
			</Tooltip>
			<Tooltip tip="Hide OTUs with low coverage support">
				<ButtonToggle
					onPressedChange={(filterOtus) => setSearch({ filterOtus })}
					pressed={Boolean(filterOtus)}
				>
					Filter OTUs
				</ButtonToggle>
			</Tooltip>
			<Tooltip tip="Hide isolates with low coverage support">
				<ButtonToggle
					onPressedChange={(filterIsolates) => setSearch({ filterIsolates })}
					pressed={Boolean(filterIsolates)}
				>
					Filter Isolates
				</ButtonToggle>
			</Tooltip>
			<Dropdown>
				<DropdownButton>
					<span>
						<Icon icon={FileDown} /> Export <Icon icon={ChevronDown} />
					</span>
				</DropdownButton>
				<DropdownMenuContent>
					<DropdownMenuDownload href={`/analyses/documents/${analysisId}.csv`}>
						<Icon icon={File} /> CSV
					</DropdownMenuDownload>
					<DropdownMenuDownload href={`/analyses/documents/${analysisId}.xlsx`}>
						<Icon icon={File} /> Excel
					</DropdownMenuDownload>
				</DropdownMenuContent>
			</Dropdown>
		</SearchToolbar>
	);
}
