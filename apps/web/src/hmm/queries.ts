import { hmmQueryKeys } from "@hmm/keys";
import { findHmmsFn, getHmmFn, installHmmFn } from "@server/hmm/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { HmmSearchResult } from "@virtool/contracts";

/**
 * Query options for a page of HMM search results.
 *
 * @param page - The page to fetch
 * @param perPage - The number of hmms to fetch per page
 * @param term - The search term to filter the hmms by
 */
export function hmmsQueryOptions(page: number, perPage: number, term?: string) {
	return queryOptions<HmmSearchResult, Error>({
		queryKey: hmmQueryKeys.list([page, perPage, term]),
		queryFn: () => findHmmsFn({ data: { page, perPage, term: term ?? "" } }),
	});
}

/**
 * Fetch a page of HMM search results.
 *
 * For secondary data — an HMM-install alert beside a list, a workflow
 * compatibility check. Primary list data uses {@link useSuspenseHmms}.
 *
 * @param page - The page to fetch
 * @param perPage - The number of hmms to fetch per page
 * @param term - The search term to filter the hmms by
 * @returns A page of hmms search results
 */
export function useListHmms(page: number, perPage: number, term?: string) {
	return useQuery(hmmsQueryOptions(page, perPage, term));
}

/**
 * Fetch a page of HMM search results, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the HMM list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseHmms(page: number, perPage: number, term?: string) {
	return useSuspenseQuery(hmmsQueryOptions(page, perPage, term));
}

/**
 * Fetches a single HMM
 *
 * @param hmmId - The id of the hmm to fetch
 * @returns A single HMM
 */
export function useFetchHmm(hmmId: number) {
	return useQuery({
		queryKey: hmmQueryKeys.detail(hmmId),
		queryFn: () => getHmmFn({ data: { hmmId } }),
	});
}

/**
 * Initializes a mutator for installing hmms
 *
 * @returns A mutator for installing hmms
 */
export function useInstallHmm() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => installHmmFn(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: hmmQueryKeys.lists() });
		},
	});
}
