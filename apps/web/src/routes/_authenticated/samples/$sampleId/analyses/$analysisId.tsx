import AnalysisDetail from "@analyses/components/AnalysisDetail";
import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { useRecordAnalysisView } from "@analyses/queries";
import {
	type AnalysisSearch,
	DEFAULT_ANALYSIS_SEARCH as DEFAULTS,
} from "@analyses/search";
import { getErrorStatus } from "@app/queryErrors";
import { bool, numInRange, oneOf, str, strOptional } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import {
	createFileRoute,
	notFound,
	stripSearchParams,
} from "@tanstack/react-router";

const SORT_DIRECTIONS = ["asc", "desc"] as const;

/**
 * Resolve the viewer's search params, filling in every default.
 *
 * Components read what this returns, so a default is written once, here — never
 * again at a call site, where a second copy can disagree with this one.
 */
function validateAnalysisDetailSearch(
	input: Partial<AnalysisSearch> & SearchSchemaInput,
): AnalysisSearch {
	return {
		dir: oneOf(input.dir, SORT_DIRECTIONS, DEFAULTS.dir),
		find: str(input.find, DEFAULTS.find),
		hit: strOptional(input.hit),
		minCoverage: numInRange(input.minCoverage, 0, 1, DEFAULTS.minCoverage),
		reads: bool(input.reads, DEFAULTS.reads),
		showLowIsolates: bool(input.showLowIsolates, DEFAULTS.showLowIsolates),
		showLowOtus: bool(input.showLowOtus, DEFAULTS.showLowOtus),
		showUnhitOrfs: bool(input.showUnhitOrfs, DEFAULTS.showUnhitOrfs),
		showUnhitSequences: bool(
			input.showUnhitSequences,
			DEFAULTS.showUnhitSequences,
		),
		sort: strOptional(input.sort),
		table: bool(input.table, DEFAULTS.table),
	};
}

export const Route = createFileRoute(
	"/_authenticated/samples/$sampleId/analyses/$analysisId",
)({
	validateSearch: validateAnalysisDetailSearch,
	// `validateSearch` puts every default back on the way in, so dropping them
	// on the way out costs nothing and keeps a shared link down to the params
	// its sender actually changed.
	search: { middlewares: [stripSearchParams(DEFAULTS)] },
	loader: async ({ context: { queryClient }, params: { analysisId } }) => {
		const { analysisQueryOptions, analysisResultsQueryOptions } = await import(
			"@analyses/queries"
		);

		// The results are the slow half of an analysis, and nothing above the
		// viewer needs them. Start the request here so it runs alongside the one
		// below, but don't hold the route open for it — the viewer suspends on it
		// instead. `prefetchQuery` swallows its own errors; the viewer's
		// `useSuspenseQuery` is what surfaces them.
		void queryClient.prefetchQuery(
			analysisResultsQueryOptions(Number(analysisId)),
		);

		try {
			await queryClient.ensureQueryData(
				analysisQueryOptions(Number(analysisId)),
			);
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: AnalysisRoute,
});

function AnalysisRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { analysisId } = Route.useParams();

	useRecordAnalysisView(Number(analysisId));

	return (
		<AnalysisSearchProvider
			search={search}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
		>
			<AnalysisDetail />
		</AnalysisSearchProvider>
	);
}
