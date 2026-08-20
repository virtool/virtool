import { type Paginated, paginated } from "@app/pagination";
import { calendarDate, numberArray, str, stringArray } from "@app/searchParams";
import SamplesList from "@samples/components/SamplesList";
import { getDateFilter } from "@samples/dateFilter";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

/** Search params for the samples list. */
type SamplesSearch = Paginated & {
	createdAfter: string | undefined;
	createdBefore: string | undefined;
	term: string;
	labels: number[];
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
		term: str(input.term, ""),
		labels: numberArray(input.labels, []),
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
			filterLabels={search.labels}
			page={search.page}
			term={search.term}
			users={search.users}
			workflows={search.workflows}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
		/>
	);
}
