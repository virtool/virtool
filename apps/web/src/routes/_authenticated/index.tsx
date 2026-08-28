import { oneOf } from "@app/searchParams";
import Dashboard from "@dashboard/components/Dashboard";
import {
	RECENT_MODES,
	type RecentMode,
} from "@dashboard/components/RecentModeToggle";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

/** Which set each dashboard "recently" card lists. */
type DashboardSearch = {
	analyses: RecentMode;
	samples: RecentMode;
};

function validateDashboardSearch(
	input: Partial<DashboardSearch> & SearchSchemaInput,
): DashboardSearch {
	return {
		analyses: oneOf(input.analyses, RECENT_MODES, "viewed"),
		samples: oneOf(input.samples, RECENT_MODES, "viewed"),
	};
}

export const Route = createFileRoute("/_authenticated/")({
	validateSearch: validateDashboardSearch,
	component: DashboardRoute,
});

function DashboardRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<Dashboard
			analysesMode={search.analyses}
			onAnalysesModeChange={(analyses) =>
				navigate({ search: { ...search, analyses } })
			}
			onSamplesModeChange={(samples) =>
				navigate({ search: { ...search, samples } })
			}
			samplesMode={search.samples}
		/>
	);
}
