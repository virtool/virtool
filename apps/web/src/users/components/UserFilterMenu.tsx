import { useFetchAccount } from "@account/account";
import { DropdownMenuSeparator } from "@base/Dropdown";
import { FilterMenuCheckboxItem, FilterMenuContent } from "@base/Filter";
import Input from "@base/Input";
import QueryError from "@base/QueryError";
import { useListUsers } from "@users/queries";
import type { UserNested } from "@virtool/contracts";
import { useState } from "react";

type UserFilterMenuProps = {
	/** Deselects every user. */
	onClear: () => void;

	/** Toggles a single user. */
	onToggle: (userId: number) => void;

	/** The ids of the selected users. */
	selected: number[];
};

/**
 * A dropdown menu for selecting the users a list is filtered by
 */
export default function UserFilterMenu({
	onClear,
	onToggle,
	selected,
}: UserFilterMenuProps) {
	const { data: users, isError, isPending } = useListUsers();
	const { data: account } = useFetchAccount();
	const [term, setTerm] = useState("");

	const matches = (users ?? []).filter((user) =>
		user.handle.toLowerCase().includes(term.toLowerCase()),
	);

	// Filtering to your own work is the common case, so lift yourself out of the
	// alphabetical list.
	const self = matches.find((user) => user.id === account?.id);
	const others = matches.filter((user) => user.id !== account?.id);

	function renderUser(user: UserNested, isSelf: boolean) {
		return (
			<FilterMenuCheckboxItem
				checked={selected.includes(user.id)}
				key={user.id}
				onCheckedChange={() => onToggle(user.id)}
			>
				<span className="flex-grow truncate">{user.handle}</span>
				{isSelf && (
					<span className="shrink-0 pl-2 text-gray-500 text-sm">You</span>
				)}
			</FilterMenuCheckboxItem>
		);
	}

	return (
		<FilterMenuContent onClear={onClear} showClear={selected.length > 0}>
			<div className="sticky top-0 bg-white p-1">
				<Input
					aria-label="Filter users"
					onChange={(e) => setTerm((e.target as HTMLInputElement).value)}
					// The menu's typeahead would otherwise swallow every keystroke
					// and move focus onto the matching user.
					onKeyDown={(e) => e.stopPropagation()}
					placeholder="Handle"
					value={term}
				/>
			</div>
			{isError && !users ? (
				<QueryError noun="users" />
			) : isPending ? (
				<p className="m-0 px-2 py-1.5 text-gray-500 text-sm">
					Loading users...
				</p>
			) : matches.length === 0 ? (
				<p className="m-0 px-2 py-1.5 text-gray-500 text-sm">No users found.</p>
			) : (
				<>
					{self && (
						<>
							{renderUser(self, true)}
							{others.length > 0 && <DropdownMenuSeparator />}
						</>
					)}
					{others.length > 0 && (
						// Capped at twelve users so a large instance doesn't grow the menu
						// past the viewport.
						<div
							className="max-h-96 overflow-x-hidden overflow-y-auto"
							data-testid="other-users"
						>
							{others.map((user) => renderUser(user, false))}
						</div>
					)}
				</>
			)}
		</FilterMenuContent>
	);
}
