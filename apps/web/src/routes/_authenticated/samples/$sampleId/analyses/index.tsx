import AnalysesList from "@analyses/components/AnalysisList";
import {
	ANALYSES_LIST_SEARCH_DEFAULTS,
	type AnalysesListSearch,
	analysesListSearch,
} from "@analyses/listSearch";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

function validateAnalysesListSearch(
	input: Partial<AnalysesListSearch> & SearchSchemaInput,
): AnalysesListSearch {
	return analysesListSearch(input);
}

export const Route = createFileRoute(
	"/_authenticated/samples/$sampleId/analyses/",
)({
	validateSearch: validateAnalysesListSearch,
	// `validateSearch` puts every default back on the way in, so dropping them on
	// the way out keeps a shared link down to the params its sender changed.
	search: { middlewares: [stripSearchParams(ANALYSES_LIST_SEARCH_DEFAULTS)] },
	component: AnalysesRoute,
});

function AnalysesRoute() {
	const { sampleId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<AnalysesList
			direction={search.direction}
			page={search.page}
			sampleId={Number(sampleId)}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
			sort={search.sort}
			users={search.users}
			workflows={search.workflows}
		/>
	);
}
