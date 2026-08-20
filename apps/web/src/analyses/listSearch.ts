import { supportedWorkflows } from "@analyses/utils";
import { type Paginated, paginated } from "@app/pagination";
import {
	numberArray,
	oneOf,
	oneOfArray,
	oneOfOptional,
} from "@app/searchParams";
import {
	ANALYSIS_SORT_FIELDS,
	type AnalysisSortField,
	type AnalysisWorkflow,
	SORT_DIRECTIONS,
	type SortDirection,
} from "@virtool/contracts";

/**
 * The params an analyses list route resolves for itself, and so strips from the
 * URL on the way out.
 */
export const ANALYSES_LIST_SEARCH_DEFAULTS: AnalysesListSearch = {
	direction: "descending",
	page: 1,
	users: [],
	workflows: [],
};

/**
 * The search params a route listing a sample's analyses takes.
 *
 * Apart from {@link AnalysisSearch}, which is the presentation state of a single
 * analysis's viewer.
 */
export type AnalysesListSearch = Paginated & {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	/** The column the list is sorted by, or undefined for the default order */
	sort?: AnalysisSortField;

	/** The ids of the users whose analyses are shown, or empty for every user */
	users: number[];

	/** The workflows whose analyses are shown, or empty for every workflow */
	workflows: AnalysisWorkflow[];
};

/**
 * Coerce the search params an analyses list route accepts.
 *
 * The direction stands on its own so a link can carry one without a column, but
 * the server ignores it until a column is chosen — the default ordering is
 * newest first either way.
 */
export function analysesListSearch(input: {
	direction?: unknown;
	page?: unknown;
	sort?: unknown;
	users?: unknown;
	workflows?: unknown;
}): AnalysesListSearch {
	return {
		...paginated(input),
		direction: oneOf(
			input.direction,
			SORT_DIRECTIONS,
			ANALYSES_LIST_SEARCH_DEFAULTS.direction,
		),
		sort: oneOfOptional(input.sort, ANALYSIS_SORT_FIELDS),
		users: numberArray(input.users, []),
		workflows: oneOfArray(input.workflows, supportedWorkflows, []),
	};
}
