import {
	createSubtractionFn,
	deleteSubtractionFn,
	findSubtractionsFn,
	getSubtractionFn,
	listSubtractionsShortlistFn,
	updateSubtractionFn,
} from "@server/subtraction/functions";
import { subtractionQueryKeys } from "@subtraction/keys";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	Subtraction,
	SubtractionNested,
	SubtractionSearchResult,
} from "@virtool/contracts";

/**
 * Initializes a mutator for creating a subtraction
 *
 * @returns A mutator for creating a subtraction
 */
export function useCreateSubtraction() {
	const queryClient = useQueryClient();

	return useMutation<
		Subtraction,
		Error,
		{ name: string; nickname: string; uploadId: number }
	>({
		mutationFn: ({ name, nickname, uploadId }) =>
			createSubtractionFn({
				data: { name, nickname, uploadId },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: subtractionQueryKeys.lists(),
			});
		},
	});
}

/**
 * Query options for a page of subtraction search results.
 *
 * @param page - The page to fetch
 * @param perPage - The number of subtractions to fetch per page
 * @param term - The search term to filter the subtractions by
 */
export function subtractionsQueryOptions(
	page: number,
	perPage: number,
	term: string,
) {
	return queryOptions<SubtractionSearchResult, Error>({
		queryKey: subtractionQueryKeys.list([page, perPage, term]),
		queryFn: () =>
			findSubtractionsFn({
				data: { page, perPage, term },
			}),
	});
}

/**
 * Fetch a page of subtraction search results, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the subtraction list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseSubtractions(
	page: number,
	perPage: number,
	term: string,
) {
	return useSuspenseQuery(subtractionsQueryOptions(page, perPage, term));
}

/**
 * Fetches a single subtraction
 *
 * @param subtractionId - The id of the subtraction to fetch
 * @returns A single subtraction
 */
export function useFetchSubtraction(subtractionId: number) {
	return useQuery<Subtraction, Error>({
		queryKey: subtractionQueryKeys.detail(subtractionId),
		queryFn: () =>
			getSubtractionFn({
				data: { subtractionId },
			}),
	});
}

/**
 * Initializes a mutator for updating a subtraction
 *
 * @param subtractionId - The id of the subtraction to update
 * @returns A mutator for updating a subtraction
 */
export function useUpdateSubtraction(subtractionId: number) {
	const queryClient = useQueryClient();
	return useMutation<Subtraction, Error, { name: string; nickname: string }>({
		mutationFn: ({ name, nickname }) =>
			updateSubtractionFn({
				data: { subtractionId, name, nickname },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: subtractionQueryKeys.detail(subtractionId),
			});
		},
	});
}

/**
 * Initializes a mutator for deleting a subtraction
 *
 * @returns A mutator for deleting a subtraction
 */
export function useDeleteSubtraction() {
	return useMutation<null, Error, { subtractionId: number }>({
		mutationFn: ({ subtractionId }) =>
			deleteSubtractionFn({
				data: { subtractionId },
			}) as Promise<null>,
	});
}

/**
 * Fetches the reduced list of every subtraction for selectors.
 *
 * Each item carries its `ready` flag; a caller that wants only ready
 * subtractions filters client-side, so every consumer shares one cache entry.
 *
 * @returns A list of subtractions
 */
export function useFetchSubtractionsShortlist() {
	return useQuery<SubtractionNested[]>({
		queryKey: subtractionQueryKeys.shortlist(),
		queryFn: () => listSubtractionsShortlistFn(),
	});
}
