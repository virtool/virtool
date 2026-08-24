import { cn } from "@app/cn";
import { useCombobox } from "downshift";
import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import ComboBoxMenu from "./ComboBoxMenu";
import Icon from "./Icon";
import InputLabel from "./InputLabel";
import { inputHeightClass } from "./styles";

type ComboBoxProps<Item> = {
	/** The text label associated with the combobox input */
	label: string;

	/** Hides the label visually, keeping it for assistive technology. Use when
	 * the combobox sits in a section that is already labelled. */
	hideLabel?: boolean;

	/** The full set of selectable items, already filtered by `term` */
	items: Item[];

	/** The currently selected item, or null when nothing is selected */
	selectedItem: Item | null;

	/** Called with the newly selected item */
	onChange: (item: Item) => void;

	/** The controlled search term. Selecting an option does not change it — set
	 * it from `onChange` if the selection should appear in the input. */
	term: string;

	/** Called when the search term changes */
	onTermChange: (term: string) => void;

	/** A stable key for an item, used as the React key */
	itemToKey: (item: Item) => string;

	/** The display string for an item, used for filtering and screen readers */
	itemToString: (item: Item) => string;

	/** Custom content for an option row; defaults to the item's display string */
	renderOption?: (item: Item) => ReactNode;

	/** Placeholder for the search input */
	placeholder?: string;
};

/**
 * An accessible single-select combobox.
 *
 * A searchable input filters a dropdown of options. Built on Downshift's
 * `useCombobox` for WAI-ARIA combobox semantics and keyboard support.
 */
export default function ComboBox<Item>({
	label,
	hideLabel = false,
	items,
	selectedItem,
	onChange,
	term,
	onTermChange,
	itemToKey,
	itemToString,
	renderOption,
	placeholder,
}: ComboBoxProps<Item>) {
	const {
		isOpen,
		getToggleButtonProps,
		getLabelProps,
		getMenuProps,
		getInputProps,
		getItemProps,
		highlightedIndex,
	} = useCombobox<Item>({
		items,
		itemToString: (item) => (item ? itemToString(item) : ""),
		inputValue: term,
		selectedItem,
		onStateChange({ inputValue: newInput, type, selectedItem: newItem }) {
			switch (type) {
				case useCombobox.stateChangeTypes.InputKeyDownEnter:
				case useCombobox.stateChangeTypes.ItemClick:
					if (newItem) {
						onChange(newItem);
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
						"items-center",
						"gap-1.5",
						"bg-white",
						"border",
						"border-gray-300",
						"rounded",
						"px-2",
						"focus-within:border-blue-500",
						"focus-within:ring",
						"focus-within:ring-blue-500/30",
						inputHeightClass,
					)}
				>
					<input
						className="flex-grow min-w-0 bg-transparent outline-none text-base"
						placeholder={placeholder}
						{...getInputProps()}
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
						(items.length ? (
							items.map((item, index) => (
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
