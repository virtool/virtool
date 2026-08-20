import type { SortDirection } from "@virtool/contracts";

/**
 * The direction a table takes when a column header is clicked.
 *
 * A column already sorted by reverses; a new one starts ascending, so the first
 * click on any header moves the list somewhere it visibly wasn't. Pairs with
 * {@link SortableHead}, which reports the field and leaves the state to its
 * caller.
 */
export function nextSortDirection<T extends string>(
	field: T,
	sort: T | undefined,
	direction: SortDirection,
): SortDirection {
	return sort === field && direction === "ascending"
		? "descending"
		: "ascending";
}
