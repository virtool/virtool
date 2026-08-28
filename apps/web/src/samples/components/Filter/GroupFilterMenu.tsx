import { FilterMenuCheckboxItem, FilterMenuContent } from "@base/Filter";
import type { GroupMinimal } from "@virtool/contracts";

type GroupFilterMenuProps = {
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
 * A dropdown menu for selecting the groups that samples are filtered by
 */
export default function GroupFilterMenu({
	groups,
	onClear,
	onToggle,
	selected,
}: GroupFilterMenuProps) {
	return (
		<FilterMenuContent onClear={onClear} showClear={selected.length > 0}>
			{groups.length === 0 ? (
				<p className="m-0 px-2 py-1.5 text-gray-500 text-sm">
					No groups have samples.
				</p>
			) : (
				groups.map((group) => (
					<FilterMenuCheckboxItem
						checked={selected.includes(group.id)}
						key={group.id}
						onCheckedChange={() => onToggle(group.id)}
					>
						<span className="flex-grow truncate">{group.name}</span>
					</FilterMenuCheckboxItem>
				))
			)}
		</FilterMenuContent>
	);
}
