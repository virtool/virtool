/**
 * The paginated search-result envelope returned by every server-function-backed
 * list. A domain carrying extra summary fields — a ready count, per-state job
 * counts — intersects this rather than restating the five.
 */
export type SearchResult = {
	/** The number of items found */
	foundCount: number;

	/** The current page number */
	page: number;

	/** The total number of pages */
	pageCount: number;

	/** The number of items per page */
	perPage: number;

	/** The total number of items */
	totalCount: number;
};

/**
 * The directions a sorted list can be ordered in. The members match the values
 * `aria-sort` takes, so a sortable column header can pass one straight through.
 */
export const SORT_DIRECTIONS = ["ascending", "descending"] as const;

/** The direction a sorted list is ordered in. */
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
