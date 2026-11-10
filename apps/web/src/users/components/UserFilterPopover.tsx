import { useFetchAccount } from "@account/account";
import { cn } from "@app/cn";
import Input from "@base/Input";
import { PopoverContent } from "@base/Popover";
import QueryError from "@base/QueryError";
import type { UserNested } from "@virtool/contracts";
import { useCombobox } from "downshift";
import { Check } from "lucide-react";
import { useState } from "react";

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
 *
 * It is a combobox with an inline listbox. Focus stays in the search input
 * while the arrow keys move the highlight and Enter toggles the highlighted
 * user, so a user can type a handle and pick it without leaving the keyboard.
 */
export default function UserFilterPopover(props: UserFilterPopoverProps) {
	const [term, setTerm] = useState("");

	return (
		<PopoverContent
			aria-label="Filter by user"
			className="w-64 p-1"
			onEscapeKeyDown={(e) => {
				// The first Escape clears the search, and the next closes the popover.
				if (term) {
					e.preventDefault();
					setTerm("");
				}
			}}
		>
			<UserFilterCombobox {...props} onTermChange={setTerm} term={term} />
		</PopoverContent>
	);
}

type UserFilterComboboxProps = UserFilterPopoverProps & {
	onTermChange: (term: string) => void;
	term: string;
};

/**
 * The search input and listbox of a {@link UserFilterPopover}, mounted only
 * while the popover is open so Downshift finds its elements.
 */
function UserFilterCombobox({
	isError,
	isPending,
	onClear,
	onTermChange,
	onToggle,
	selected,
	term,
	users,
}: UserFilterComboboxProps) {
	const { data: account } = useFetchAccount();

	const matches = (users ?? []).filter((user) =>
		user.handle.toLowerCase().includes(term.toLowerCase()),
	);

	// Filtering to your own work is the common case, so lift yourself out of the
	// alphabetical list.
	const self = matches.find((user) => user.id === account?.id);
	const others = matches.filter((user) => user.id !== account?.id);
	const items = self ? [self, ...others] : others;

	const { getInputProps, getItemProps, getMenuProps, highlightedIndex } =
		useCombobox<UserNested>({
			items,
			itemToString: (user) => user?.handle ?? "",
			inputValue: term,
			isOpen: true,
			selectedItem: null,
			defaultHighlightedIndex: 0,
			stateReducer(state, { changes, type }) {
				switch (type) {
					case useCombobox.stateChangeTypes.InputKeyDownEnter:
					case useCombobox.stateChangeTypes.ItemClick:
						// Keep the highlight on the toggled user so the next pick
						// starts from where the last one left off.
						return { ...changes, highlightedIndex: state.highlightedIndex };
					default:
						return changes;
				}
			},
			onStateChange({ inputValue, selectedItem, type }) {
				switch (type) {
					case useCombobox.stateChangeTypes.InputKeyDownEnter:
					case useCombobox.stateChangeTypes.ItemClick:
						if (selectedItem) {
							onToggle(selectedItem.id);
						}
						break;
					case useCombobox.stateChangeTypes.InputChange:
						onTermChange(inputValue ?? "");
						break;
					default:
						break;
				}
			},
		});

	function renderUser(user: UserNested, index: number) {
		const isSelected = selected.includes(user.id);

		return (
			<div
				className={cn(
					"cursor-pointer flex gap-2 items-center px-2 py-1.5 rounded-sm select-none text-gray-900",
					highlightedIndex === index && "bg-gray-100",
				)}
				key={user.id}
				{...getItemProps({
					item: user,
					index,
					// The listbox is multi-selectable, so `aria-selected` reports
					// whether the user is in the filter. Downshift would otherwise
					// set it on the highlighted option.
					"aria-selected": isSelected,
				})}
			>
				<span className="flex items-center justify-center shrink-0 size-4">
					{isSelected && <Check className="size-3.5" strokeWidth={3} />}
				</span>
				<span className="flex-grow truncate">{user.handle}</span>
				{user === self && (
					<span className="shrink-0 pl-2 text-gray-500 text-sm">You</span>
				)}
			</div>
		);
	}

	function renderStatus() {
		if (isError && !users) {
			return <QueryError noun="users" />;
		}

		if (isPending) {
			return <StatusMessage>Loading users...</StatusMessage>;
		}

		if (items.length === 0) {
			return <StatusMessage>No users found.</StatusMessage>;
		}

		return null;
	}

	return (
		<>
			<Input
				placeholder="Handle"
				{...getInputProps({ "aria-label": "Filter users" })}
			/>
			{renderStatus()}
			<div
				aria-label="Users"
				aria-multiselectable
				role="listbox"
				className={cn("mt-1", items.length === 0 && "hidden")}
				{...getMenuProps()}
			>
				{self && renderUser(self, 0)}
				{others.length > 0 && (
					// Capped at twelve users so a large instance doesn't grow the
					// popover past the viewport.
					<div
						className={cn(
							"max-h-96 overflow-x-hidden overflow-y-auto",
							self && "border-gray-200 border-t mt-1 pt-1",
						)}
						data-testid="other-users"
					>
						{others.map((user, index) =>
							renderUser(user, self ? index + 1 : index),
						)}
					</div>
				)}
			</div>
			{selected.length > 0 && (
				<div className="border-gray-200 border-t mt-1 pt-1">
					<button
						className="cursor-pointer px-2 py-1.5 rounded-sm text-blue-600 text-left w-full hover:bg-blue-50 hover:text-blue-700"
						onClick={onClear}
						type="button"
					>
						Clear
					</button>
				</div>
			)}
		</>
	);
}

function StatusMessage({ children }: { children: string }) {
	return <p className="m-0 px-2 py-1.5 text-gray-500 text-sm">{children}</p>;
}
