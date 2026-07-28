import { DEFAULT_PER_PAGE, type Paginated, paginated } from "@app/pagination";
import { str } from "@app/searchParams";
import OtuList from "@otus/components/OtuList";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

/** Search params for this route. */
type OtuListSearch = Paginated & {
	term: string;
};

function validateOtuListSearch(
	input: Partial<OtuListSearch> & SearchSchemaInput,
): OtuListSearch {
	return {
		...paginated(input),
		term: str(input.term, ""),
	};
}

export const Route = createFileRoute("/_authenticated/refs/$refId/otus/")({
	validateSearch: validateOtuListSearch,
	loaderDeps: ({ search: { term, page } }) => ({ term, page }),
	loader: async ({
		context: { queryClient },
		params: { refId },
		deps: { term, page },
	}) => {
		const { otusQueryOptions } = await import("@otus/queries");
		await queryClient.ensureQueryData(
			otusQueryOptions(Number(refId), page, DEFAULT_PER_PAGE, term),
		);
	},
	component: OtusRoute,
});

function OtusRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<OtuList
			term={search.term}
			page={search.page}
			setSearch={(next, options) =>
				navigate({
					search: { ...search, ...next },
					replace: options?.replace,
				})
			}
		/>
	);
}
