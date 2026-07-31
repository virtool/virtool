import { cn } from "@app/cn";
import Dropdown from "@base/Dropdown";
import DropdownButton from "@base/DropdownButton";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuRadioGroup from "@base/DropdownMenuRadioGroup";
import DropdownMenuRadioItem from "@base/DropdownMenuRadioItem";
import Icon from "@base/Icon";
import type { AnalysisWorkflow } from "@virtool/contracts";
import { ArrowUpDown, ChevronDown } from "lucide-react";

const sortKeys: Record<AnalysisWorkflow, string[]> = {
	pathoscope: ["coverage", "depth", "weight", "name"],
	nuvs: ["length", "e", "orfs"],
};

const sortTitles: Record<string, string> = {
	coverage: "Coverage",
	depth: "Depth",
	e: "E-Value",
	length: "Length",
	orfs: "ORFs",
	weight: "Weight",
	identity: "Identity",
	name: "Name",
};

type AnalysisViewerSortProps = {
	workflow: AnalysisWorkflow;
	sortKey: string;
	onSelect: (key: string) => void;
};

export function AnalysisViewerSort({
	workflow,
	sortKey,
	onSelect,
}: AnalysisViewerSortProps) {
	const keys = sortKeys[workflow] ?? [];

	// `sortKey` comes from the URL unvalidated, so it can name a key this
	// workflow does not offer — which would leave the trigger showing nothing.
	const activeKey = keys.includes(sortKey) ? sortKey : (keys[0] ?? sortKey);

	return (
		<Dropdown>
			<DropdownButton aria-label={`Sort by ${sortTitles[activeKey]}`}>
				<Icon icon={ArrowUpDown} />
				{/* Every key stacked in one grid cell, so the trigger is as wide as the
				    longest and picking another cannot shift the toolbar. `invisible`
				    keeps the unpicked ones out of the accessibility tree too. */}
				<span className="grid">
					{keys.map((key) => (
						<span
							className={cn(
								"col-start-1",
								"row-start-1",
								key !== activeKey && "invisible",
							)}
							key={key}
						>
							{sortTitles[key]}
						</span>
					))}
				</span>
				<Icon icon={ChevronDown} />
			</DropdownButton>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={activeKey} onValueChange={onSelect}>
					{keys.map((key) => (
						<DropdownMenuRadioItem key={key} value={key}>
							{sortTitles[key]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</Dropdown>
	);
}
