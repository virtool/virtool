import { analysesQueryKeys } from "@analyses/keys";
import { samplesQueryKeys } from "@samples/keys";
import {
	blastNuvsFn,
	createAnalysisFn,
	deleteAnalysisFn,
	findAnalysesFn,
	getAnalysisFn,
	getAnalysisResultsFn,
} from "@server/analyses/functions";
import {
	keepPreviousData,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	Analysis,
	AnalysisResults,
	AnalysisSearchResult,
	AnalysisWorkflow,
} from "@virtool/contracts";

/**
 * Fetch a page of a sample's analyses
 *
 * @param sampleId - The sample which the analyses are associated with
 * @param page - The page to fetch
 * @param perPage - The number of analyses to fetch per page
 * @returns A page of analyses search results
 */
export function useListAnalyses(
	sampleId: number,
	page: number,
	perPage: number,
) {
	return useQuery<AnalysisSearchResult, Error>({
		queryKey: analysesQueryKeys.list([sampleId, page, perPage]),
		queryFn: () =>
			findAnalysesFn({
				data: { sampleId, page, perPage },
			}),
		placeholderData: keepPreviousData,
	});
}

/**
 * Fetch the most recent analyses one user started, across every sample,
 * suspending until it resolves.
 *
 * Apart from {@link useListAnalyses}, which is scoped to a single sample. The
 * server still applies the caller's own sample-read filter, so this narrows
 * within what the caller may already see.
 *
 * @param userId - The id of the user whose analyses to fetch
 * @param perPage - The number of analyses to fetch
 */
export function useSuspenseRecentAnalyses(userId: number, perPage: number) {
	return useSuspenseQuery<AnalysisSearchResult, Error>({
		queryKey: analysesQueryKeys.list(["recent", userId, perPage]),
		queryFn: () => findAnalysesFn({ data: { userId, page: 1, perPage } }),
	});
}

/**
 * Initializes a mutator for removing an analysis
 *
 * @param analysisId - The id of the analysis to remove
 * @returns A mutator for removing an analysis
 */
export function useRemoveAnalysis(analysisId: number) {
	const queryClient = useQueryClient();

	const mutation = useMutation<null, Error, { analysisId: number }>({
		mutationFn: ({ analysisId }) => deleteAnalysisFn({ data: { analysisId } }),

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: analysesQueryKeys.lists(),
			});
		},
	});

	return () => mutation.mutate({ analysisId });
}

export function analysisQueryOptions(analysisId: number) {
	return queryOptions<Analysis, Error>({
		queryKey: analysesQueryKeys.detail(analysisId),
		queryFn: () => getAnalysisFn({ data: { analysisId } }),
	});
}

export function useGetAnalysis(analysisId: number) {
	return useQuery(analysisQueryOptions(analysisId));
}

/**
 * The results of an analysis, cached apart from the analysis itself.
 *
 * This is the slow half — the server reads the whole results blob and patches
 * every OTU the analysis hit back to the version it saw — so it is deliberately
 * not part of {@link analysisQueryOptions}. The route fires it off without
 * awaiting it and the viewer suspends on it, leaving the header free to render
 * as soon as the metadata lands.
 */
export function analysisResultsQueryOptions(analysisId: number) {
	return queryOptions<AnalysisResults, Error>({
		queryKey: analysesQueryKeys.results(analysisId),
		queryFn: () => getAnalysisResultsFn({ data: { analysisId } }),
	});
}

/**
 * Fetch an analysis's results, suspending until they arrive — loading is handled
 * by the viewer's `<Suspense>` and errors by the route's `errorComponent`.
 */
export function useSuspenseAnalysisResults(analysisId: number) {
	return useSuspenseQuery(analysisResultsQueryOptions(analysisId));
}

export type CreateAnalysisParams = {
	refId: number;
	sampleId: number;
	subtractionIds?: number[];
	workflow: AnalysisWorkflow;
};

export function useCreateAnalysis() {
	const queryClient = useQueryClient();

	return useMutation<Analysis, Error, CreateAnalysisParams>({
		mutationFn: ({ refId, sampleId, subtractionIds, workflow }) =>
			createAnalysisFn({
				data: {
					sampleId,
					refId,
					subtractionIds: subtractionIds ?? [],
					workflow,
				},
			}) as Promise<Analysis>,

		onSuccess: (_data, { sampleId }) => {
			// Only this sample's analyses list gained a row, so leave every other
			// sample's analyses alone.
			queryClient.invalidateQueries({
				queryKey: [...analysesQueryKeys.lists(), sampleId],
			});
			// The sample's workflow state changed, and the samples-list row renders
			// `sample.workflows` from its own list entry — so a Quick Analyze
			// started from that list would otherwise keep showing stale workflow
			// tags until a remount. The sample's detail cache is refreshed by the
			// SSE `samples/update` frame, not here.
			queryClient.invalidateQueries({
				queryKey: samplesQueryKeys.lists(),
			});
		},
	});
}

/**
 * Initializes a mutator for installing blast information for a sequence
 *
 * @param analysisId - The id of the analysis the sequence belongs to
 * @returns A mutator for installing the blast information
 */
export function useBlastNuvs(analysisId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ sequenceIndex }: { sequenceIndex: number }) =>
			blastNuvsFn({ data: { analysisId, sequenceIndex } }),

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: analysesQueryKeys.detail(analysisId),
			});
		},
	});
}
