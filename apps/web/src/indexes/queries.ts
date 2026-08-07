import { indexQueryKeys } from "@indexes/keys";
import {
	createIndexFn,
	findIndexesFn,
	findUnbuiltChangesFn,
	getIndexFn,
	listReadyIndexesFn,
} from "@server/indexes/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	Index,
	IndexMinimal,
	IndexSearchResult,
	UnbuiltChangesSearchResult,
} from "@virtool/contracts";

/**
 * Query options for a paginated list of a reference's indexes.
 *
 * @param referenceId - The reference to list the indexes of
 * @param page - The page to fetch
 * @param perPage - The number of indexes to fetch per page
 */
export function indexesQueryOptions(
	referenceId: number,
	page: number,
	perPage: number,
) {
	return queryOptions<IndexSearchResult, Error>({
		queryKey: indexQueryKeys.list([referenceId, page, perPage]),
		queryFn: () =>
			findIndexesFn({
				data: { referenceId, page, perPage },
			}) as Promise<IndexSearchResult>,
	});
}

/**
 * Gets a paginated list of a reference's indexes.
 *
 * For secondary data — the unbuilt-changes alert beside a list. Primary list
 * data uses {@link useSuspenseIndexes}.
 *
 * @param referenceId - The reference to list the indexes of
 * @param page - The page to fetch
 * @param perPage - The number of indexes to fetch per page
 * @returns The paginated list of indexes
 */
export function useFindIndexes(
	referenceId: number,
	page: number,
	perPage: number,
) {
	return useQuery(indexesQueryOptions(referenceId, page, perPage));
}

/**
 * Fetch a paginated list of indexes, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the index list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseIndexes(
	referenceId: number,
	page: number,
	perPage: number,
) {
	return useSuspenseQuery(indexesQueryOptions(referenceId, page, perPage));
}

/**
 * Gets every index that has finished building.
 *
 * Unpaginated: the caller offers these as the indexes an analysis can run
 * against, and picks the newest of each reference, so a page boundary would
 * silently drop candidates.
 *
 * @param archived - Filter indexes by their reference's archived status
 * @returns The list of ready indexes
 */
export function useListReadyIndexes(archived?: boolean) {
	return useQuery<IndexMinimal[], Error>({
		queryKey: indexQueryKeys.list([archived]),
		queryFn: () =>
			listReadyIndexesFn({ data: { archived } }) as Promise<IndexMinimal[]>,
	});
}

/**
 * Fetches a single index
 *
 * @param indexId - The id of the index to fetch
 * @param enabled - Whether the query should run
 * @returns A single index
 */
export function useFetchIndex(indexId: number | undefined, enabled = true) {
	return useQuery<Index, Error>({
		queryKey: indexQueryKeys.detail(indexId ?? 0),
		queryFn: () =>
			getIndexFn({
				data: { indexId: indexId as number },
			}) as Promise<Index>,
		enabled: enabled && indexId !== undefined,
	});
}

/**
 * Get the changes a reference has accumulated since its last index build
 *
 * @param referenceId - The reference to fetch unbuilt changes for
 * @returns The reference's unbuilt changes
 */
export function useFetchUnbuiltChanges(referenceId: number) {
	return useQuery<UnbuiltChangesSearchResult, Error>({
		queryKey: indexQueryKeys.unbuilt(referenceId),
		queryFn: () =>
			findUnbuiltChangesFn({
				data: { referenceId },
			}) as Promise<UnbuiltChangesSearchResult>,
	});
}

/**
 * Initializes a mutator for building an index
 *
 * @returns A mutator for building an index
 */
export function useCreateIndex() {
	const queryClient = useQueryClient();

	return useMutation<Index, Error, { referenceId: number }>({
		mutationFn: ({ referenceId }) =>
			createIndexFn({ data: { referenceId } }) as Promise<Index>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: indexQueryKeys.all(),
			});
		},
	});
}
