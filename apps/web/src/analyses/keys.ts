import { createQueryKeys, type QueryKeyFilter } from "@app/queryKeys";

const keys = createQueryKeys("analyses");

/** Query keys for analyses. */
export const analysesQueryKeys = {
	...keys,
	/** Users available for an analysis list's user filter. */
	users: (filters: readonly QueryKeyFilter[] = []) =>
		[...keys.lists(), "users", ...filters] as const,
	// An analysis's results are fetched apart from the analysis itself, so they
	// need a key of their own. Derived from `detail` so that anything
	// invalidating one analysis — an SSE frame, a mutation — invalidates its
	// results along with it.
	results: (analysisId: number) => [...keys.detail(analysisId), "results"],
};
