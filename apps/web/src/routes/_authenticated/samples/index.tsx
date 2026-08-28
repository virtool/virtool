import { type Paginated, paginated } from "@app/pagination";
import {
	calendarDate,
	numberArray,
	oneOf,
	oneOfOptional,
	str,
	stringArray,
} from "@app/searchParams";
import SamplesList from "@samples/components/SamplesList";
import { getDateFilter } from "@samples/dateFilter";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
	SAMPLE_SORT_FIELDS,
	type SampleSortField,
	SORT_DIRECTIONS,
	type SortDirection,
} from "@virtool/contracts";

/** Search params for the samples list. */
type SamplesSearch = Paginated & {
	createdAfter: string | undefined;
	createdBefore: string | undefined;
	direction: SortDirection;
	term: string;
	labels: number[];
	groups: number[];
	sort: SampleSortField | undefined;
	users: number[];
	workflows: string[];
};

function validateSamplesSearch(
	input: Partial<SamplesSearch> & SearchSchemaInput,
): SamplesSearch {
	return {
		...paginated(input),
		createdAfter: calendarDate(input.createdAfter),
		createdBefore: calendarDate(input.createdBefore),
		direction: oneOf(input.direction, SORT_DIRECTIONS, "descending"),
		term: str(input.term, ""),
		labels: numberArray(input.labels, []),
		groups: numberArray(input.groups, []),
		sort: oneOfOptional(input.sort, SAMPLE_SORT_FIELDS),
		users: numberArray(input.users, []),
		workflows: stringArray(input.workflows, []),
	};
}

export const Route = createFileRoute("/_authenticated/samples/")({
	validateSearch: validateSamplesSearch,
	component: SamplesRoute,
});

function SamplesRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<SamplesList
			dateFilter={getDateFilter(search.createdAfter, search.createdBefore)}
			direction={search.direction}
			filterGroups={search.groups}
			filterLabels={search.labels}
			page={search.page}
			sort={search.sort}
			term={search.term}
			users={search.users}
			workflows={search.workflows}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
		/>
	);
}
