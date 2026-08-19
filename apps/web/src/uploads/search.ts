import { type Paginated, paginated } from "@app/pagination";
import { oneOf, oneOfOptional } from "@app/searchParams";
import {
	SORT_DIRECTIONS,
	type SortDirection,
	UPLOAD_SORT_FIELDS,
	type UploadSortField,
} from "@virtool/contracts";

/**
 * The params an uploads list route resolves for itself, and so strips from the
 * URL on the way out.
 */
export const UPLOADS_SEARCH_DEFAULTS = {
	direction: "descending",
	page: 1,
} as const;

/** The search params a route listing uploads takes. */
export type UploadsSearch = Paginated & {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** The column the list is sorted by, or undefined for the default order */
	sort?: UploadSortField;
};

/**
 * Coerce the search params an uploads list route accepts.
 *
 * The direction stands on its own so a link can carry one without a column, but
 * the server ignores it until a column is chosen — the default ordering is
 * newest first either way.
 */
export function uploadsSearch(input: {
	direction?: unknown;
	page?: unknown;
	sort?: unknown;
}): UploadsSearch {
	return {
		...paginated(input),
		direction: oneOf(
			input.direction,
			SORT_DIRECTIONS,
			UPLOADS_SEARCH_DEFAULTS.direction,
		),
		sort: oneOfOptional(input.sort, UPLOAD_SORT_FIELDS),
	};
}
