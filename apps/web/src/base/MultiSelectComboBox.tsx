import { cn } from "@app/cn";
import { useCombobox, useMultipleSelection } from "downshift";
import { ChevronDown, X } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import ComboBoxMenu from "./ComboBoxMenu";
import Icon from "./Icon";
import InputLabel from "./InputLabel";

type MultiSelectComboBoxProps<Item> = {
	/** The text label associated with the combobox input */
	label: string;

	/** Hides the label visually, keeping it for assistive technology. Use when
	 * the combobox sits in a row that is already labelled by its column. */
	hideLabel?: boolean;

	/** The full set of selectable items, already filtered by `term` */
	items: Item[];

	/** The currently selected items */
	selectedItems: Item[];

	/** Called with the next selection when an item is added or removed */
	onChange: (selectedItems: Item[]) => void;

	/** The controlled search term */
	term: string;

	/** Called when the search term changes */
	onTermChange: (term: string) => void;

	/** A stable key for an item, used to dedupe selections and as the React key */
	itemToKey: (item: Item) => string;

	/** The display string for an item, used for filtering and screen readers */
	itemToString: (item: Item) => string;

	/** Custom content for an option row; defaults to the item's display string */
	renderOption?: (item: Item) => ReactNode;

	/** Custom content for a selected chip; defaults to the item's display string */
	renderChip?: (item: Item) => ReactNode;

	/** Placeholder for the search input */
	placeholder?: string;
};

/**
 * An accessible multi-select combobox.
 *
 * Selected items are shown as removable chips above a searchable dropdown of
 * the remaining options. Built on Downshift's `useCombobox` and
 * `useMultipleSelection` for WAI-ARIA combobox semantics and keyboard support.
 */
export default function MultiSelectComboBox<Item>({
	label,
	hideLabel = false,
	items,
	selectedItems,
	onChange,
	term,
	onTermChange,
	itemToKey,
	itemToString,
	renderOption,
	renderChip,
	placeholder,
}: MultiSelectComboBoxProps<Item>) {
	const selectedKeys = new Set(selectedItems.map(itemToKey));
	const availableItems = items.filter(
		(item) => !selectedKeys.has(itemToKey(item)),
	);

	const { getSelectedItemProps, getDropdownProps, removeSelectedItem } =
		useMultipleSelection<Item>({
			selectedItems,
			onStateChange({ selectedItems: newItems, type }) {
				switch (type) {
					case useMultipleSelection.stateChangeTypes
						.SelectedItemKeyDownBackspace:
					case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
					case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
					case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
						onChange(newItems ?? []);
						break;
					default:
						break;
				}
			},
		});

	const {
		isOpen,
		getToggleButtonProps,
		getLabelProps,
		getMenuProps,
		getInputProps,
		getItemProps,
		highlightedIndex,
	} = useCombobox<Item>({
		items: availableItems,
		itemToString: (item) => (item ? itemToString(item) : ""),
		inputValue: term,
		selectedItem: null,
		stateReducer(_state, { changes, type }) {
			switch (type) {
				case useCombobox.stateChangeTypes.InputKeyDownEnter:
				case useCombobox.stateChangeTypes.ItemClick:
					// Keep the menu open after a selection so the user can keep picking.
					return { ...changes, isOpen: true, highlightedIndex: 0 };
				default:
					return changes;
			}
		},
		onStateChange({ inputValue: newInput, type, selectedItem: newItem }) {
			switch (type) {
				case useCombobox.stateChangeTypes.InputKeyDownEnter:
				case useCombobox.stateChangeTypes.ItemClick:
					if (newItem) {
						onChange([...selectedItems, newItem]);
						onTermChange("");
					}
					break;
				case useCombobox.stateChangeTypes.InputChange:
					onTermChange(newInput ?? "");
					break;
				default:
					break;
			}
		},
	});

	const labelProps = getLabelProps();

	return (
		<div>
			<InputLabel
				className={cn(hideLabel && "sr-only")}
				htmlFor={labelProps.htmlFor}
				id={labelProps.id}
			>
				{label}
			</InputLabel>
			<Popover.Root open={isOpen} onOpenChange={() => {}}>
				<Popover.Anchor
					className={cn(
						"flex",
						"flex-wrap",
						"items-center",
						"gap-1.5",
						"min-h-10",
						"bg-white",
						"border",
						"border-gray-300",
						"rounded",
						"px-2",
						"py-2",
						"focus-within:border-blue-500",
						"focus-within:ring",
						"focus-within:ring-blue-500/30",
					)}
				>
					{selectedItems.map((item, index) => (
						<span
							key={itemToKey(item)}
							className={cn(
								"inline-flex",
								"items-center",
								"gap-1",
								"bg-gray-100",
								"border",
								"border-gray-200",
								"rounded",
								"pl-2",
								"pr-1",
								"py-0.5",
								"text-sm",
								"select-none",
							)}
							{...getSelectedItemProps({ selectedItem: item, index })}
						>
							{renderChip ? renderChip(item) : itemToString(item)}
							<button
								type="button"
								aria-label={`Remove ${itemToString(item)}`}
								className="text-gray-500 hover:text-gray-800"
								onClick={(e) => {
									e.stopPropagation();
									removeSelectedItem(item);
								}}
							>
								<Icon icon={X} className="size-4" />
							</button>
						</span>
					))}
					<input
						className="flex-grow min-w-24 bg-transparent outline-none text-base"
						placeholder={placeholder}
						{...getInputProps(getDropdownProps({ preventKeyAction: isOpen }))}
					/>
					<button
						type="button"
						aria-label={`Toggle ${label} menu`}
						className="text-gray-500 hover:text-gray-800"
						{...getToggleButtonProps()}
					>
						<Icon icon={ChevronDown} />
					</button>
				</Popover.Anchor>
				<ComboBoxMenu
					menuProps={getMenuProps(undefined, { suppressRefError: true })}
				>
					{isOpen &&
						(availableItems.length ? (
							availableItems.map((item, index) => (
								<li
									key={itemToKey(item)}
									className={cn(
										"flex",
										"items-center",
										"justify-between",
										"gap-2",
										"px-3",
										"py-2",
										"cursor-pointer",
										highlightedIndex === index ? "bg-gray-100" : "bg-white",
									)}
									{...getItemProps({ item, index })}
								>
									{renderOption ? renderOption(item) : itemToString(item)}
								</li>
							))
						) : (
							<li className="px-3 py-2 text-gray-500">No options</li>
						))}
				</ComboBoxMenu>
			</Popover.Root>
		</div>
	);
}
