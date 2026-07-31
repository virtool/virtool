import Dropdown from "@base/Dropdown";
import DropdownButton from "@base/DropdownButton";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuRadioGroup from "@base/DropdownMenuRadioGroup";
import DropdownMenuRadioItem from "@base/DropdownMenuRadioItem";
import type { AnalysisWorkflow } from "@virtool/contracts";
import { ArrowUpDown, ChevronDown } from "lucide-react";

const sortKeys: Record<AnalysisWorkflow, string[]> = {
	pathoscope: ["coverage", "depth", "weight"],
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
	return (
		<Dropdown>
			<DropdownButton className="flex items-center">
				<span>
					<ArrowUpDown className="size-1" /> Sort: {sortTitles[sortKey]}
				</span>
				<ChevronDown size={18} />
			</DropdownButton>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={sortKey} onValueChange={onSelect}>
					{(sortKeys[workflow] ?? []).map((key) => (
						<DropdownMenuRadioItem key={key} value={key}>
							{sortTitles[key]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</Dropdown>
	);
}
