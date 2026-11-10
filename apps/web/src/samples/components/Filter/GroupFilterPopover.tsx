import { cn } from "@app/cn";
import Input from "@base/Input";
import { PopoverContent } from "@base/Popover";
import type { GroupMinimal } from "@virtool/contracts";
import { useCombobox } from "downshift";
import { Check } from "lucide-react";
import { useState } from "react";

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
 *
 * It is a combobox with an inline listbox. Focus stays in the search input
 * while the arrow keys move the highlight and Enter toggles the highlighted
 * group, so a user can type a name and pick it without leaving the keyboard.
 */
export default function GroupFilterPopover(props: GroupFilterPopoverProps) {
	const [term, setTerm] = useState("");

	return (
		<PopoverContent
			aria-label="Filter by group"
			className="w-64 p-1"
			onEscapeKeyDown={(e) => {
				// The first Escape clears the search, and the next closes the popover.
				if (term) {
					e.preventDefault();
					setTerm("");
				}
			}}
		>
			<GroupFilterCombobox {...props} onTermChange={setTerm} term={term} />
		</PopoverContent>
	);
}

type GroupFilterComboboxProps = GroupFilterPopoverProps & {
	onTermChange: (term: string) => void;
	term: string;
};

/**
 * The search input and listbox of a {@link GroupFilterPopover}, mounted only
 * while the popover is open so Downshift finds its elements.
 */
function GroupFilterCombobox({
	groups,
	onClear,
	onTermChange,
	onToggle,
	selected,
	term,
}: GroupFilterComboboxProps) {
	const items = groups.filter((group) =>
		group.name.toLowerCase().includes(term.toLowerCase()),
	);

	const { getInputProps, getItemProps, getMenuProps, highlightedIndex } =
		useCombobox<GroupMinimal>({
			items,
			itemToString: (group) => group?.name ?? "",
			inputValue: term,
			isOpen: true,
			selectedItem: null,
			defaultHighlightedIndex: 0,
			stateReducer(state, { changes, type }) {
				switch (type) {
					case useCombobox.stateChangeTypes.InputKeyDownEnter:
					case useCombobox.stateChangeTypes.ItemClick:
						// Keep the highlight on the toggled group so the next pick
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

	function renderStatus() {
		if (groups.length === 0) {
			return <StatusMessage>No groups have samples.</StatusMessage>;
		}

		if (items.length === 0) {
			return <StatusMessage>No groups found.</StatusMessage>;
		}

		return null;
	}

	return (
		<>
			<Input
				placeholder="Name"
				{...getInputProps({ "aria-label": "Filter groups" })}
			/>
			{renderStatus()}
			<div
				aria-label="Groups"
				aria-multiselectable
				role="listbox"
				className={cn(
					"max-h-96 mt-1 overflow-x-hidden overflow-y-auto",
					items.length === 0 && "hidden",
				)}
				{...getMenuProps()}
			>
				{items.map((group, index) => {
					const isSelected = selected.includes(group.id);

					return (
						<div
							className={cn(
								"cursor-pointer flex gap-2 items-center px-2 py-1.5 rounded-sm select-none text-gray-900",
								highlightedIndex === index && "bg-gray-100",
							)}
							key={group.id}
							{...getItemProps({
								item: group,
								index,
								// The listbox is multi-selectable, so `aria-selected` reports
								// whether the group is in the filter. Downshift would
								// otherwise set it on the highlighted option.
								"aria-selected": isSelected,
							})}
						>
							<span className="flex items-center justify-center shrink-0 size-4">
								{isSelected && <Check className="size-3.5" strokeWidth={3} />}
							</span>
							<span className="flex-grow truncate">{group.name}</span>
						</div>
					);
				})}
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
