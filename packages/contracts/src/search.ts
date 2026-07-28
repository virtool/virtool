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
