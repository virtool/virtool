import { FilterComboboxPopover } from "@base/Filter";
import { getHexColor } from "@samples/labels";
import type { Label } from "@virtool/contracts";

type LabelFilterPopoverProps = {
	/** All available labels. */
	labels: Label[];

	/** Deselects every label. */
	onClear: () => void;

	/** Toggles a single label. */
	onToggle: (labelId: number) => void;

	/** Selected label IDs. */
	selected: number[];
};

/**
 * A popover for selecting the labels that samples are filtered by.
 */
export default function LabelFilterPopover({
	labels,
	onClear,
	onToggle,
	selected,
}: LabelFilterPopoverProps) {
	return (
		<FilterComboboxPopover
			emptyMessage="No labels have been created."
			getKey={(label) => label.id}
			getText={(label) => label.name}
			inputLabel="Filter labels"
			items={labels}
			listboxLabel="Labels"
			noMatchesMessage="No labels found."
			onClear={onClear}
			onToggle={onToggle}
			placeholder="Name"
			popoverLabel="Filter by label"
			renderItem={(label) => (
				<>
					<span
						className="rounded-full shrink-0 size-3"
						style={{ backgroundColor: getHexColor(label.color) }}
					/>
					<span className="flex-grow truncate">{label.name}</span>
				</>
			)}
			selected={selected}
		/>
	);
}
