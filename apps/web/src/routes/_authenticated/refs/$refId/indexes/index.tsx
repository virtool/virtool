import { DEFAULT_PER_PAGE, type Paginated, paginated } from "@app/pagination";
import Indexes from "@indexes/components/Indexes";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

function validateIndexesSearch(
	input: Partial<Paginated> & SearchSchemaInput,
): Paginated {
	return paginated(input);
}

export const Route = createFileRoute("/_authenticated/refs/$refId/indexes/")({
	validateSearch: validateIndexesSearch,
	loaderDeps: ({ search: { page } }) => ({ page }),
	loader: async ({
		context: { queryClient },
		params: { refId },
		deps: { page },
	}) => {
		const { indexesQueryOptions } = await import("@indexes/queries");
		await queryClient.ensureQueryData(
			indexesQueryOptions(Number(refId), page, DEFAULT_PER_PAGE),
		);
	},
	component: IndexesRoute,
});

function IndexesRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<Indexes
			page={search.page}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
		/>
	);
}
