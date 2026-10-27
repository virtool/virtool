import { FilterChip, FilterGroup } from "@base/Filter";
import type { UserNested } from "@virtool/contracts";
import { Users } from "lucide-react";
import UserFilterMenu from "./UserFilterMenu";

type UserFilterGroupProps = {
	/** Whether loading the available users failed. */
	isError: boolean;

	/** Whether the available users are loading. */
	isPending: boolean;

	/** Deselects every user. */
	onClear: () => void;

	/** Toggles a single user. */
	onToggle: (userId: number) => void;

	/** The ids of the selected users. */
	selected: number[];

	/** The users available in the current list context. */
	users?: UserNested[];
};

/**
 * The users filter of a list view, with a chip for each selected user
 */
export default function UserFilterGroup({
	isError,
	isPending,
	onClear,
	onToggle,
	selected,
	users,
}: UserFilterGroupProps) {
	const handlesById = new Map(users?.map((user) => [user.id, user.handle]));

	return (
		<FilterGroup
			icon={<Users size={14} />}
			menu={
				<UserFilterMenu
					isError={isError}
					isPending={isPending}
					onClear={onClear}
					onToggle={onToggle}
					selected={selected}
					users={users}
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
