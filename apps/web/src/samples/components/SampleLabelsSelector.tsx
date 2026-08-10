import Dropdown from "@base/Dropdown";
import DropdownMenuCheckboxItem from "@base/DropdownMenuCheckboxItem";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuLink from "@base/DropdownMenuLink";
import DropdownMenuSeparator from "@base/DropdownMenuSeparator";
import DropdownMenuTrigger from "@base/DropdownMenuTrigger";
import Icon from "@base/Icon";
import Input from "@base/Input";
import { getHexColor, getSelectedLabels } from "@samples/labels";
import { useUpdateLabel } from "@samples/queries";
import type { Label, Sample, SampleMinimal } from "@virtool/contracts";
import { Tag } from "lucide-react";
import { useState } from "react";

type SampleLabelsSelectorProps = {
	/** Every label that exists */
	labels: Label[];

	/** Called with the patched samples once a label has been added or removed */
	onLabelsUpdated: (samples: Sample[]) => void;

	/** The samples the label edits apply to */
	selectedSamples: SampleMinimal[];
};

/**
 * A dropdown for adding and removing labels across the selected samples.
 */
export default function SampleLabelsSelector({
	labels,
	onLabelsUpdated,
	selectedSamples,
}: SampleLabelsSelectorProps) {
	const selectedLabels = getSelectedLabels(selectedSamples);
	const { mutate: updateLabel } = useUpdateLabel(
		selectedLabels,
		selectedSamples,
	);
	const [term, setTerm] = useState("");

	const matches = labels.filter((label) =>
		label.name.toLowerCase().includes(term.toLowerCase()),
	);

	function getChecked(labelId: number): boolean | "indeterminate" {
		const selected = selectedLabels.find((label) => label.id === labelId);

		if (!selected) {
			return false;
		}

		return selected.allLabeled ? true : "indeterminate";
	}

	return (
		<Dropdown>
			<DropdownMenuTrigger
				aria-label="Edit labels"
				className="h-8 items-center gap-1.5 rounded bg-gray-100 px-3 text-gray-500 text-sm hover:bg-gray-500 hover:text-white focus:bg-gray-400 focus:text-white focus:outline-none"
			>
				<Icon icon={Tag} /> Labels
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-64">
				<div className="sticky top-0 bg-white p-1">
					<Input
						aria-label="Filter labels"
						onChange={(e) => setTerm((e.target as HTMLInputElement).value)}
						// The menu's typeahead would otherwise swallow every keystroke
						// and move focus onto the matching label.
						onKeyDown={(e) => e.stopPropagation()}
						placeholder="Label name"
						value={term}
					/>
				</div>
				{matches.length === 0 ? (
					<p className="px-2 py-1.5 text-gray-500 text-sm">No labels found.</p>
				) : (
					matches.map((label) => (
						<DropdownMenuCheckboxItem
							checked={getChecked(label.id)}
							key={label.id}
							onCheckedChange={() =>
								updateLabel(label.id, { onSuccess: onLabelsUpdated })
							}
							// Keep the menu open so several labels can be toggled at once.
							onSelect={(e) => e.preventDefault()}
						>
							<span
								className="rounded-full shrink-0 size-3"
								style={{ backgroundColor: getHexColor(label.color) }}
							/>
							<span className="flex-grow truncate">{label.name}</span>
						</DropdownMenuCheckboxItem>
					))
				)}
				<DropdownMenuSeparator />
				<DropdownMenuLink to="/samples/labels">Manage labels</DropdownMenuLink>
			</DropdownMenuContent>
		</Dropdown>
	);
}
