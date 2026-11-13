import { cn } from "@app/cn";
import Input from "@base/Input";
import { PopoverContent } from "@base/Popover";
import { useCombobox } from "downshift";
import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";

type FilterComboboxPopoverProps<T, K extends number | string> = {
	/** The message shown when there are no items at all. */
	emptyMessage: string;

	/** Returns the key that identifies an item in `selected`. */
	getKey: (item: T) => K;

	/** Returns the text that the search matches and that names an item. */
	getText: (item: T) => string;

	/** The accessible label of the search input. */
	inputLabel: string;

	/** The items to choose from, in display order. */
	items: T[];

	/** The accessible label of the listbox. */
	listboxLabel: string;

	/** The message shown when no item matches the search. */
	noMatchesMessage: string;

	/** Deselects every item. */
	onClear: () => void;

	/** Toggles a single item. */
	onToggle: (key: K) => void;

	/** An item shown first, apart from the scrolling list, if it matches. */
	pinned?: T;

	/** The placeholder of the search input. */
	placeholder: string;

	/** The accessible label of the popover. */
	popoverLabel: string;

	/** Renders an item's content after its check mark. Defaults to its text. */
	renderItem?: (item: T) => ReactNode;

	/** A test ID for the scrolling list. */
	scrollAreaTestId?: string;

	/** The keys of the selected items. */
	selected: K[];

	/**
	 * A status, such as a loading notice, shown in place of the empty and
	 * no-match messages. A string is styled as a status message.
	 */
	status?: ReactNode;
};

/**
 * A popover for selecting the items that a list is filtered by.
 *
 * It is a combobox with an inline listbox. Focus stays in the search input
 * while the arrow keys move the highlight and Enter toggles the highlighted
 * item, so a user can type a name and pick it without leaving the keyboard.
 */
export default function FilterComboboxPopover<T, K extends number | string>(
	props: FilterComboboxPopoverProps<T, K>,
) {
	const [term, setTerm] = useState("");

	return (
		<PopoverContent
			aria-label={props.popoverLabel}
			className="w-64 p-1"
			onEscapeKeyDown={(e) => {
				// The first Escape clears the search, and the next closes the popover.
				if (term) {
					e.preventDefault();
					setTerm("");
				}
			}}
		>
			<FilterCombobox {...props} onTermChange={setTerm} term={term} />
		</PopoverContent>
	);
}

type FilterComboboxProps<
	T,
	K extends number | string,
> = FilterComboboxPopoverProps<T, K> & {
	onTermChange: (term: string) => void;
	term: string;
};

/**
 * The search input and listbox of a {@link FilterComboboxPopover}, mounted
 * only while the popover is open so Downshift finds its elements.
 */
function FilterCombobox<T, K extends number | string>({
	emptyMessage,
	getKey,
	getText,
	inputLabel,
	items,
	listboxLabel,
	noMatchesMessage,
	onClear,
	onTermChange,
	onToggle,
	pinned,
	placeholder,
	renderItem,
	scrollAreaTestId,
	selected,
	status,
	term,
}: FilterComboboxProps<T, K>) {
	function isMatch(item: T) {
		return getText(item).toLowerCase().includes(term.toLowerCase());
	}

	const matches = items.filter(isMatch);
	const pinnedMatch = pinned !== undefined && isMatch(pinned) ? pinned : null;
	const options = pinnedMatch === null ? matches : [pinnedMatch, ...matches];

	const { getInputProps, getItemProps, getMenuProps, highlightedIndex } =
		useCombobox<T>({
			items: options,
			itemToString: (item) => (item === null ? "" : getText(item)),
			inputValue: term,
			isOpen: true,
			selectedItem: null,
			defaultHighlightedIndex: 0,
			stateReducer(state, { changes, type }) {
				switch (type) {
					case useCombobox.stateChangeTypes.InputKeyDownEnter:
					case useCombobox.stateChangeTypes.ItemClick:
						// Keep the highlight on the toggled item so the next pick
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
							onToggle(getKey(selectedItem));
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

	function renderOption(item: T, index: number) {
		const isSelected = selected.includes(getKey(item));

		return (
			<div
				className={cn(
					"cursor-pointer flex gap-2 items-center px-2 py-1.5 rounded-sm select-none text-gray-900",
					highlightedIndex === index && "bg-gray-100",
				)}
				key={getKey(item)}
				{...getItemProps({
					item,
					index,
					// The listbox is multi-selectable, so `aria-selected` reports
					// whether the item is in the filter. Downshift would otherwise
					// set it on the highlighted option.
					"aria-selected": isSelected,
				})}
			>
				<span className="flex items-center justify-center shrink-0 size-4">
					{isSelected && <Check className="size-3.5" strokeWidth={3} />}
				</span>
				{renderItem ? (
					renderItem(item)
				) : (
					<span className="flex-grow truncate">{getText(item)}</span>
				)}
			</div>
		);
	}

	function renderStatus() {
		if (status) {
			return typeof status === "string" ? (
				<StatusMessage>{status}</StatusMessage>
			) : (
				status
			);
		}

		if (items.length === 0 && pinned === undefined) {
			return <StatusMessage>{emptyMessage}</StatusMessage>;
		}

		if (options.length === 0) {
			return <StatusMessage>{noMatchesMessage}</StatusMessage>;
		}

		return null;
	}

	const offset = pinnedMatch === null ? 0 : 1;

	return (
		<>
			<Input
				placeholder={placeholder}
				{...getInputProps({ "aria-label": inputLabel })}
			/>
			{renderStatus()}
			<div
				aria-label={listboxLabel}
				aria-multiselectable
				role="listbox"
				className={cn("mt-1", options.length === 0 && "hidden")}
				{...getMenuProps()}
			>
				{pinnedMatch !== null && renderOption(pinnedMatch, 0)}
				{matches.length > 0 && (
					// Capped at twelve items so a long list doesn't grow the popover
					// past the viewport.
					<div
						className={cn(
							"max-h-96 overflow-x-hidden overflow-y-auto",
							pinnedMatch !== null && "border-gray-200 border-t mt-1 pt-1",
						)}
						data-testid={scrollAreaTestId}
					>
						{matches.map((item, index) => renderOption(item, index + offset))}
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
