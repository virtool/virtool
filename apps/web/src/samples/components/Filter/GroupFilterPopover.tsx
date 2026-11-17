import { FilterComboboxPopover } from "@base/Filter";
import type { GroupMinimal } from "@virtool/contracts";

type GroupFilterPopoverProps = {
	/** All available groups. */
	groups: GroupMinimal[];

	/** Deselects every group. */
	onClear: () => void;

	/** Toggles a single group. */
	onToggle: (groupId: number) => void;

	/** Selected group IDs. */
	selected: number[];
};

/**
 * A popover for selecting the groups that samples are filtered by.
 */
export default function GroupFilterPopover({
	groups,
	onClear,
	onToggle,
	selected,
}: GroupFilterPopoverProps) {
	return (
		<FilterComboboxPopover
			emptyMessage="No groups have samples."
			getKey={(group) => group.id}
			getText={(group) => group.name}
			inputLabel="Filter groups"
			items={groups}
			listboxLabel="Groups"
			noMatchesMessage="No groups found."
			onClear={onClear}
			onToggle={onToggle}
			placeholder="Name"
			popoverLabel="Filter by group"
			selected={selected}
		/>
	);
}
