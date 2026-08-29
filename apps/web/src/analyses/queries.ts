import { analysesQueryKeys } from "@analyses/keys";
import { samplesQueryKeys } from "@samples/keys";
import {
	blastNuvsFn,
	createAnalysisFn,
	deleteAnalysisFn,
	findAnalysesFn,
	findRecentlyViewedAnalysesFn,
	getAnalysisFn,
	getAnalysisResultsFn,
	recordAnalysisViewFn,
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
	AnalysisSortField,
	AnalysisWorkflow,
	SortDirection,
} from "@virtool/contracts";
import { useEffect } from "react";

/** The page, ordering, and filters {@link useListAnalyses} requests. */
export type ListAnalysesOptions = {
	/** The direction the sorted column is ordered in */
	direction: SortDirection;

	page: number;
	perPage: number;

	/** The sample the analyses belong to */
	sampleId: number;

	/** The column to order by, or undefined for newest first */
	sort?: AnalysisSortField;

	/** The ids of the users whose analyses to show, or empty for every user */
	userIds: number[];

	/** The workflows to show analyses of, or empty for every workflow */
	workflows: AnalysisWorkflow[];
};

/**
 * Fetch a page of a sample's analyses
 *
 * @param options - The page, ordering, and filters to request
 * @returns A page of analyses search results
 */
export function useListAnalyses({
	direction,
	page,
	perPage,
	sampleId,
	sort,
	userIds,
	workflows,
}: ListAnalysesOptions) {
	return useQuery<AnalysisSearchResult, Error>({
		// The sample id leads the key so that creating an analysis can invalidate
		// one sample's lists without touching another's.
		queryKey: analysesQueryKeys.list([
			sampleId,
			page,
			perPage,
			sort,
			direction,
			userIds,
			workflows,
		]),
		queryFn: () =>
			findAnalysesFn({
				data: { sampleId, page, perPage, sort, direction, userIds, workflows },
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
		queryFn: () =>
			findAnalysesFn({ data: { userIds: [userId], page: 1, perPage } }),
	});
}

/**
 * Fetch the analyses the signed-in user has most recently viewed, suspending
 * until it resolves.
 *
 * The server scopes the list to the caller's own views, so it takes no user id.
 *
 * @param perPage - The number of analyses to fetch
 */
export function useSuspenseRecentlyViewedAnalyses(perPage: number) {
	return useSuspenseQuery<AnalysisSearchResult, Error>({
		queryKey: analysesQueryKeys.list(["recentlyViewed", perPage]),
		queryFn: () => findRecentlyViewedAnalysesFn({ data: { perPage } }),
	});
}

/**
 * Record, once per mount, that the signed-in user has viewed an analysis.
 *
 * Runs from an effect rather than the route loader, because the router preloads
 * loaders on hover (`defaultPreload: "intent"`) — a view must count only when
 * the analysis is actually opened, not merely pointed at.
 *
 * @param analysisId - The id of the viewed analysis
 */
export function useRecordAnalysisView(analysisId: number) {
	const queryClient = useQueryClient();

	const { mutate } = useMutation<null, Error, number>({
		mutationFn: (id) => recordAnalysisViewFn({ data: { analysisId: id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: analysesQueryKeys.list(["recentlyViewed"]),
			});
		},
	});

	useEffect(() => {
		if (Number.isInteger(analysisId)) {
			mutate(analysisId);
		}
	}, [analysisId, mutate]);
}

/**
 * Initializes a mutator for deleting an analysis
 *
 * @param analysisId - The id of the analysis to delete
 * @returns A mutator for deleting an analysis
 */
export function useDeleteAnalysis(analysisId: number) {
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
