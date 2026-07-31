import { DEFAULT_PER_PAGE, type Paginated, paginated } from "@app/pagination";
import { oneOfArray } from "@app/searchParams";
import JobsList from "@jobs/components/JobList";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import type { JobState } from "@virtool/contracts";

const jobStates = [
	"cancelled",
	"failed",
	"pending",
	"running",
	"succeeded",
] as const satisfies ReadonlyArray<JobState>;

const initialState: JobState[] = ["pending", "running"];

/** Search params for the jobs list. */
type JobsSearch = Paginated & {
	state: JobState[];
};

function validateJobsSearch(
	input: Partial<JobsSearch> & SearchSchemaInput,
): JobsSearch {
	return {
		...paginated(input),
		state: oneOfArray(input.state, jobStates, initialState),
	};
}

export const Route = createFileRoute("/_authenticated/jobs/")({
	validateSearch: validateJobsSearch,
	loaderDeps: ({ search: { page, state } }) => ({ page, state }),
	loader: async ({ context: { queryClient }, deps: { page, state } }) => {
		const { jobsQueryOptions } = await import("@jobs/queries");
		await queryClient.ensureQueryData(
			jobsQueryOptions(page, DEFAULT_PER_PAGE, state),
		);
	},
	component: JobsRoute,
});

function JobsRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<JobsList
			page={search.page}
			states={search.state}
			setSearch={(next) => navigate({ search: { ...search, ...next } })}
		/>
	);
}
