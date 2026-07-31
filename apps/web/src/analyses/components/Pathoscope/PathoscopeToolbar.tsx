import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { DEFAULT_SORT_KEY } from "@analyses/search";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import Button from "@base/Button";
import ButtonGroup from "@base/ButtonGroup";
import ButtonToggle from "@base/ButtonToggle";
import Icon from "@base/Icon";
import SearchToolbar from "@base/SearchToolbar";
import ToggleGroup from "@base/ToggleGroup";
import ToggleGroupItem from "@base/ToggleGroupItem";
import Tooltip from "@base/Tooltip";
import {
	ArrowDownAZ,
	ArrowDownWideNarrow,
	ArrowUpAZ,
	ArrowUpWideNarrow,
	ChartArea,
	Hash,
	Table,
} from "lucide-react";
import { AnalysisViewerSort } from "../Viewer/Sort";
import { collapsingLabel } from "./collapsingLabel";
import PathoscopeExport from "./PathoscopeExport";
import PathoscopeFilter from "./PathoscopeFilter";

type PathoscopeToolbarProps = {
	/** The analysis being viewed */
	analysis: FormattedPathoscopeAnalysis;
};

/** A selection of filters and toggles for pathoscope data presentation */
export function PathoscopeToolbar({ analysis }: PathoscopeToolbarProps) {
	const { search, setSearch } = useAnalysisSearch();
	const { dir, find, reads, table } = search;
	const sortKey = search.sort ?? DEFAULT_SORT_KEY.pathoscope;

	// The wide-to-narrow arrows read as magnitude, which a name sort is not.
	const directionIcons =
		sortKey === "name"
			? { asc: ArrowUpAZ, desc: ArrowDownAZ }
			: { asc: ArrowUpWideNarrow, desc: ArrowDownWideNarrow };

	return (
		<SearchToolbar
			aria-label="Search results"
			onChange={(find) => setSearch({ find })}
			value={find}
		>
			<ButtonGroup>
				<AnalysisViewerSort
					workflow="pathoscope"
					sortKey={sortKey}
					onSelect={(sort) => setSearch({ sort })}
				/>
				<Button
					aria-label={dir === "desc" ? "Sort ascending" : "Sort descending"}
					onClick={() => setSearch({ dir: dir === "desc" ? "asc" : "desc" })}
				>
					<Icon
						icon={dir === "desc" ? directionIcons.desc : directionIcons.asc}
					/>
				</Button>
			</ButtonGroup>
			<ToggleGroup
				onValueChange={(value) => setSearch({ table: value === "table" })}
				value={table ? "table" : "charts"}
			>
				<Tooltip tip="Chart view">
					<ToggleGroupItem aria-label="Charts" value="charts">
						<Icon icon={ChartArea} />
						<span className={collapsingLabel}>Charts</span>
					</ToggleGroupItem>
				</Tooltip>
				<Tooltip tip="Table view">
					<ToggleGroupItem aria-label="Table" value="table">
						<Icon icon={Table} />
						<span className={collapsingLabel}>Table</span>
					</ToggleGroupItem>
				</Tooltip>
			</ToggleGroup>
			<Tooltip tip="Show read pseudo-counts instead of weight">
				<ButtonToggle
					aria-label="Show Reads"
					onPressedChange={(reads) => setSearch({ reads })}
					pressed={reads}
				>
					<Icon icon={Hash} />
					<span className={collapsingLabel}>Show Reads</span>
				</ButtonToggle>
			</Tooltip>
			<PathoscopeFilter />
			<PathoscopeExport analysis={analysis} />
		</SearchToolbar>
	);
}
