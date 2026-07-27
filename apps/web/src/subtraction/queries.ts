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
import type { ErrorResponse } from "@/types/api";
import type {
	Subtraction,
	SubtractionOption,
	SubtractionSearchResult,
} from "./types";

/**
 * Initializes a mutator for creating a subtraction
 *
 * @returns A mutator for creating a subtraction
 */
export function useCreateSubtraction() {
	const queryClient = useQueryClient();

	return useMutation<
		Subtraction,
		ErrorResponse,
		{ name: string; nickname: string; uploadId: number }
	>({
		mutationFn: ({ name, nickname, uploadId }) =>
			createSubtractionFn({
				data: { name, nickname, uploadId },
			}) as Promise<Subtraction>,
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
 * @param per_page - The number of subtractions to fetch per page
 * @param term - The search term to filter the subtractions by
 */
export function subtractionsQueryOptions(
	page: number,
	per_page: number,
	term: string,
) {
	return queryOptions<SubtractionSearchResult, ErrorResponse>({
		queryKey: subtractionQueryKeys.list([page, per_page, term]),
		queryFn: () =>
			findSubtractionsFn({
				data: { page, per_page, term },
			}) as Promise<SubtractionSearchResult>,
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
	per_page: number,
	term: string,
) {
	return useSuspenseQuery(subtractionsQueryOptions(page, per_page, term));
}

/**
 * Fetches a single subtraction
 *
 * @param subtractionId - The id of the subtraction to fetch
 * @returns A single subtraction
 */
export function useFetchSubtraction(subtractionId: number) {
	return useQuery<Subtraction, ErrorResponse>({
		queryKey: subtractionQueryKeys.detail(subtractionId),
		queryFn: () =>
			getSubtractionFn({
				data: { subtractionId },
			}) as Promise<Subtraction>,
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
	return useMutation<
		Subtraction,
		ErrorResponse,
		{ name: string; nickname: string }
	>({
		mutationFn: ({ name, nickname }) =>
			updateSubtractionFn({
				data: { subtractionId, name, nickname },
			}) as Promise<Subtraction>,
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
	return useMutation<null, ErrorResponse, { subtractionId: number }>({
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
	return useQuery<SubtractionOption[]>({
		queryKey: subtractionQueryKeys.shortlist(),
		queryFn: () =>
			listSubtractionsShortlistFn() as Promise<SubtractionOption[]>,
	});
}
