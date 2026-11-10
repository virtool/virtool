import { useFetchAccount } from "@account/account";
import { FilterComboboxPopover } from "@base/Filter";
import QueryError from "@base/QueryError";
import type { UserNested } from "@virtool/contracts";

type UserFilterPopoverProps = {
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
 * A popover for selecting the users a list is filtered by.
 */
export default function UserFilterPopover({
	isError,
	isPending,
	onClear,
	onToggle,
	selected,
	users,
}: UserFilterPopoverProps) {
	const { data: account } = useFetchAccount();

	// Filtering to your own work is the common case, so lift yourself out of the
	// alphabetical list.
	const self = users?.find((user) => user.id === account?.id);
	const others = (users ?? []).filter((user) => user.id !== account?.id);

	function renderStatus() {
		if (isError && !users) {
			return <QueryError noun="users" />;
		}

		if (isPending) {
			return "Loading users...";
		}

		return null;
	}

	return (
		<FilterComboboxPopover
			emptyMessage="No users found."
			getKey={(user) => user.id}
			getText={(user) => user.handle}
			inputLabel="Filter users"
			items={others}
			listboxLabel="Users"
			noMatchesMessage="No users found."
			onClear={onClear}
			onToggle={onToggle}
			pinned={self}
			placeholder="Handle"
			popoverLabel="Filter by user"
			renderItem={(user) => (
				<>
					<span className="flex-grow truncate">{user.handle}</span>
					{user === self && (
						<span className="shrink-0 pl-2 text-gray-500 text-sm">You</span>
					)}
				</>
			)}
			scrollAreaTestId="other-users"
			selected={selected}
			status={renderStatus()}
		/>
	);
}
