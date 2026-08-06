import type { LabelNested } from "@labels/types";
import { samplesQueryKeys } from "@samples/keys";
import {
	createSampleFn,
	deleteSampleFn,
	findSamplesFn,
	getSampleFn,
	updateSampleFn,
	updateSampleRightsFn,
} from "@server/samples/functions";
import {
	keepPreviousData,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { fileQueryKeys } from "@uploads/keys";
import type {
	LibraryType,
	Sample,
	SampleMinimal,
	SampleRightsUpdate,
	SampleSearchResult,
} from "@virtool/contracts";
import { union } from "es-toolkit";
import type { CreateSampleRequest, SampleUpdate } from "./types";

/** A label carried by at least one of the selected samples */
export type SampleLabel = LabelNested & {
	/** Whether all selected samples contain the label */
	allLabeled: boolean;
};

function samplesQueryOptions(
	page: number,
	per_page: number,
	term?: string,
	labels?: number[],
	workflows?: string[],
	users?: number[],
) {
	return queryOptions<SampleSearchResult, Error>({
		queryKey: samplesQueryKeys.list([
			page,
			per_page,
			term,
			labels,
			workflows,
			users,
		]),
		queryFn: () =>
			findSamplesFn({
				data: {
					page,
					perPage: per_page,
					term: term ?? "",
					labels: labels ?? [],
					workflows: workflows ?? [],
					users: users ?? [],
				},
			}) as Promise<SampleSearchResult>,
	});
}

/**
 * Fetch a page of samples from the API
 *
 * @param page - The page to fetch
 * @param per_page - The number of samples to fetch per page
 * @param term - The search term to filter samples by
 * @param labels - The labels to filter the samples by
 * @param workflows - The workflows to filter the samples by
 * @param users - The ids of the users to filter the samples by
 */
export function useListSamples(
	page: number,
	per_page: number,
	term?: string,
	labels?: number[],
	workflows?: string[],
	users?: number[],
) {
	return useQuery({
		...samplesQueryOptions(page, per_page, term, labels, workflows, users),
		placeholderData: keepPreviousData,
	});
}

/**
 * Fetch a page of samples, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws instead of resolving to
 * `undefined`. Use this where the page is a view's primary data, so loading is
 * handled by the enclosing `Suspense` rather than an inline placeholder.
 *
 * It shares its cache entry with {@link useListSamples} — the same arguments
 * build the same key — but carries no `placeholderData`, which a suspense query
 * rejects.
 */
export function useSuspenseSamples(
	page: number,
	per_page: number,
	term?: string,
	labels?: number[],
	workflows?: string[],
	users?: number[],
) {
	return useSuspenseQuery(
		samplesQueryOptions(page, per_page, term, labels, workflows, users),
	);
}

export function sampleQueryOptions(sampleId: number) {
	return queryOptions<Sample, Error>({
		queryKey: samplesQueryKeys.detail(sampleId),
		queryFn: () => getSampleFn({ data: { sampleId } }) as Promise<Sample>,
	});
}

export function useFetchSample(sampleId: number) {
	return useQuery({
		...sampleQueryOptions(sampleId),
		enabled: Number.isInteger(sampleId),
	});
}

/**
 * Fetch a sample, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from
 * components rendered under a route whose loader prefetches the sample (the
 * `$sampleId` detail layout and its children) — loading and errors are handled
 * by the route's Suspense and `errorComponent` rather than inline.
 */
export function useSuspenseSample(sampleId: number) {
	return useSuspenseQuery(sampleQueryOptions(sampleId));
}

/**
 * Initialize a mutator for creating a sample
 *
 * @returns A mutator for creating a sample
 */
export function useCreateSample() {
	const queryClient = useQueryClient();

	return useMutation<Sample, Error, CreateSampleRequest>({
		mutationFn: ({
			name,
			isolate,
			host,
			locale,
			libraryType,
			subtractions,
			files,
			labels,
			group,
		}) =>
			createSampleFn({
				data: {
					name,
					isolate,
					host,
					locale,
					libraryType: libraryType as LibraryType,
					subtractions,
					files,
					labels,
					group,
				},
			}) as Promise<Sample>,
		onSuccess: () => {
			// The created sample reserves its read files, so the server stops
			// returning them. Only the reads selector shows them — an infinite
			// list — so refetch just that, not every upload type and page.
			queryClient.invalidateQueries({
				queryKey: [...fileQueryKeys.infiniteLists(), "reads"],
			});
		},
	});
}

/**
 * Initialize a mutator for updating a sample
 *
 * @returns A mutator for updating a sample
 */
export function useUpdateSample(sampleId: number) {
	const queryClient = useQueryClient();

	return useMutation<Sample, Error, { update: SampleUpdate }>({
		mutationFn: ({ update }) =>
			updateSampleFn({
				data: { sampleId, ...update },
			}) as Promise<Sample>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: samplesQueryKeys.detail(sampleId),
			});
		},
	});
}

/**
 * Initialize a mutator for removing a sample
 *
 * @returns A mutator for removing a sample
 */
export function useRemoveSample() {
	return useMutation<null, Error, { sampleId: number }>({
		mutationFn: ({ sampleId }) =>
			deleteSampleFn({ data: { sampleId } }) as Promise<null>,
	});
}

/**
 * Initialize a mutator for updating a samples rights
 *
 * @returns A mutator for updating a samples rights
 */
export function useUpdateSampleRights(sampleId: number) {
	return useMutation<Sample, Error, { update: SampleRightsUpdate }>({
		mutationFn: ({ update }) =>
			updateSampleRightsFn({
				data: { sampleId, ...update },
			}) as Promise<Sample>,
	});
}

/**
 * Initialize a mutator that adds or removes a label across the selected samples
 *
 * The label is removed when every selected sample already carries it, and added
 * otherwise. The samples are patched concurrently and the list is invalidated
 * once, after they all settle. The mutation resolves with the updated samples.
 *
 * @param selectedLabels - The labels carried by the selected samples
 * @param selectedSamples - The selected samples
 * @returns A mutator taking the id of the label to toggle
 */
export function useUpdateLabel(
	selectedLabels: SampleLabel[],
	selectedSamples: SampleMinimal[],
) {
	const queryClient = useQueryClient();

	return useMutation<Sample[], Error, number>({
		mutationFn: (labelId) => {
			const clicked = selectedLabels.find((label) => label.id === labelId);
			const allLabeled = clicked?.allLabeled === true;

			return Promise.all(
				selectedSamples.map((sample) => {
					const labelIds = sample.labels.map((label) => label.id);

					return updateSampleFn({
						data: {
							sampleId: sample.id,
							labels: allLabeled
								? labelIds.filter((id) => id !== labelId)
								: union(labelIds, [labelId]),
						},
					}) as Promise<Sample>;
				}),
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: samplesQueryKeys.lists(),
			});
		},
	});
}
