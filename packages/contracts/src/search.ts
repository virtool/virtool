/**
 * The paginated search-result envelope returned by every server-function-backed
 * list. A domain carrying extra summary fields — a ready count, per-state job
 * counts — intersects this rather than restating the five.
 *
 * Both counts are scoped to what the caller may read. `totalCount` then counts
 * everything in that scope, while `foundCount` also applies the narrowing
 * filters the caller asked for, so a list can tell "you have none" apart from
 * "your filters matched none". A domain with no narrowing filters reports the
 * same number twice.
 */
export type SearchResult = {
	/** The number of readable items matching the caller's filters */
	foundCount: number;

	/** The current page number */
	page: number;

	/** The total number of pages */
	pageCount: number;

	/** The number of items per page */
	perPage: number;

	/** The number of readable items before the caller's filters */
	totalCount: number;
};

/**
 * The directions a sorted list can be ordered in. The members match the values
 * `aria-sort` takes, so a sortable column header can pass one straight through.
 */
export const SORT_DIRECTIONS = ["ascending", "descending"] as const;

/** The direction a sorted list is ordered in. */
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
