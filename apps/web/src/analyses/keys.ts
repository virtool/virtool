import { createQueryKeys } from "@app/queryKeys";

const keys = createQueryKeys("analyses");

/** Query keys for analyses. */
export const analysesQueryKeys = {
	...keys,
	// An analysis's results are fetched apart from the analysis itself, so they
	// need a key of their own. Derived from `detail` so that anything
	// invalidating one analysis — an SSE frame, a mutation — invalidates its
	// results along with it.
	results: (analysisId: number) => [...keys.detail(analysisId), "results"],
};
