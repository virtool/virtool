import { FilterChip, FilterGroup } from "@base/Filter";
import { useListUsers } from "@users/queries";
import { Users } from "lucide-react";
import UserFilterMenu from "./UserFilterMenu";

type UserFilterGroupProps = {
	/** Deselects every user. */
	onClear: () => void;

	/** Toggles a single user. */
	onToggle: (userId: number) => void;

	/** The ids of the selected users. */
	selected: number[];
};

/**
 * The users filter of a list view, with a chip for each selected user
 */
export default function UserFilterGroup({
	onClear,
	onToggle,
	selected,
}: UserFilterGroupProps) {
	// Shares a query key with the menu's own list, so this resolves from the cache
	// rather than issuing a second request.
	const { data: users, isPending } = useListUsers();

	const handlesById = new Map(users?.map((user) => [user.id, user.handle]));

	return (
		<FilterGroup
			icon={<Users size={14} />}
			menu={
				<UserFilterMenu
					onClear={onClear}
					onToggle={onToggle}
					selected={selected}
				/>
			}
			title="Users"
		>
			{selected.map((userId) => {
				const handle = handlesById.get(userId);

				return (
					<FilterChip
						key={userId}
						onRemove={() => onToggle(userId)}
						removeLabel={`Remove ${handle ?? `User ${userId}`} user filter`}
					>
						{handle ??
							(isPending ? (
								<span className="h-3 w-16 animate-pulse rounded-sm bg-gray-200" />
							) : (
								`User ${userId}`
							))}
					</FilterChip>
				);
			})}
		</FilterGroup>
	);
}
