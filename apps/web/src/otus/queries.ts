import { getErrorStatus } from "@app/queryErrors";
import { getGenbankFn } from "@server/genbank/functions";
import {
	createIsolateFn,
	createOtuFn,
	createSequenceFn,
	deleteIsolateFn,
	deleteOtuFn,
	deleteSequenceFn,
	findOtusFn,
	getOtuFn,
	listOtuHistoryFn,
	setIsolateAsDefaultFn,
	updateIsolateFn,
	updateOtuFn,
	updateSequenceFn,
} from "@server/otus/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	Genbank,
	Otu,
	OtuHistory,
	OtuIsolate,
	OtuSearchResult,
	OtuSegment,
	OtuSequence,
} from "@virtool/contracts";
import { otuQueryKeys } from "./keys";

/**
 * Initializes a mutator for looking up a sequence in Genbank by accession
 *
 * This is a read, but it is driven by a button press rather than by what is on
 * screen, so it is a mutation: nothing should fetch it on render, and the
 * result is not worth caching.
 *
 * @returns A mutator that takes the accession identifying the sequence
 */
export function useGetGenbank() {
	return useMutation<Genbank, Error, string>({
		mutationFn: (accession) =>
			getGenbankFn({ data: { accession } }) as Promise<Genbank>,
	});
}

/**
 * Query options for a page of OTU search results.
 *
 * @param refId - The reference id to fetch the OTUs of
 * @param page - The page to fetch
 * @param perPage - The number of OTUs to fetch per page
 * @param term - The search term to filter the OTUs by
 */
export function otusQueryOptions(
	refId: number,
	page: number,
	perPage: number,
	term: string,
) {
	return queryOptions<OtuSearchResult, Error>({
		queryKey: otuQueryKeys.list([refId, page, perPage, term]),
		queryFn: () =>
			findOtusFn({
				data: { referenceId: refId, page, perPage, term },
			}) as Promise<OtuSearchResult>,
	});
}

/**
 * Fetch a page of OTU search results, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the OTU list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseOtus(
	refId: number,
	page: number,
	perPage: number,
	term: string,
) {
	return useSuspenseQuery(otusQueryOptions(refId, page, perPage, term));
}

export function otuQueryOptions(otuId: string) {
	return queryOptions<Otu, Error>({
		queryKey: otuQueryKeys.detail(otuId),
		queryFn: () => getOtuFn({ data: { otuId } }) as Promise<Otu>,
	});
}

/**
 * Fetches a single OTU
 *
 * @param otuId - The id of the OTU to fetch
 * @returns A single OTU
 */
export function useFetchOtu(otuId: string) {
	return useQuery<Otu, Error>({
		...otuQueryOptions(otuId),
		retry: (failureCount, error) => {
			if (getErrorStatus(error) === 404) {
				return false;
			}
			return failureCount <= 3;
		},
	});
}

export function otuHistoryQueryOptions(otuId: string) {
	return queryOptions<OtuHistory[], Error>({
		queryKey: otuQueryKeys.history(otuId),
		queryFn: () =>
			listOtuHistoryFn({ data: { otuId } }) as Promise<OtuHistory[]>,
	});
}

/**
 * Fetch an OTU's history, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`.
 */
export function useSuspenseOtuHistory(otuId: string) {
	return useSuspenseQuery(otuHistoryQueryOptions(otuId));
}

/**
 * Initializes a mutator for creating an OTU
 *
 * @returns A mutator for creating an OTU
 */
export function useCreateOtu(refId: number) {
	const queryClient = useQueryClient();

	return useMutation<Otu, Error, { name: string; abbreviation: string }>({
		mutationFn: ({ name, abbreviation }) =>
			createOtuFn({
				data: { referenceId: refId, name, abbreviation, schema: [] },
			}) as Promise<Otu>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: otuQueryKeys.lists() });
		},
	});
}

/** The fields an OTU update may change, alongside the OTU to change them on. */
export type UpdateOtuProps = {
	otuId: string;
	name?: string;
	abbreviation?: string;
	schema?: OtuSegment[];
};

/**
 * Initializes a mutator for editing an OTU
 *
 * @returns A mutator for editing an OTU
 */
export function useUpdateOtu(otuId: string) {
	const queryClient = useQueryClient();

	return useMutation<Otu, Error, UpdateOtuProps, { previousOtu?: Otu }>({
		mutationFn: ({ otuId, name, abbreviation, schema }) =>
			updateOtuFn({
				data: { otuId, name, abbreviation, schema },
			}) as Promise<Otu>,
		onMutate: async ({ name, abbreviation, schema }) => {
			await queryClient.cancelQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});

			const previousOtu = queryClient.getQueryData<Otu>(
				otuQueryKeys.detail(otuId),
			);

			if (previousOtu) {
				queryClient.setQueryData<Otu>(otuQueryKeys.detail(otuId), {
					...previousOtu,
					...(name !== undefined && { name }),
					...(abbreviation !== undefined && { abbreviation }),
					...(schema !== undefined && { schema }),
				});
			}

			return { previousOtu };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousOtu) {
				queryClient.setQueryData(
					otuQueryKeys.detail(otuId),
					context.previousOtu,
				);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for deleting an OTU isolate
 *
 * @returns A mutator for deleting an OTU isolate
 */
export function useDeleteOtu() {
	return useMutation<null, Error, { otuId: string }>({
		mutationFn: ({ otuId }) =>
			deleteOtuFn({ data: { otuId } }) as Promise<null>,
	});
}

/**
 * Initializes a mutator for creating an OTU isolate
 *
 * @returns A mutator for creating an OTU isolate
 */
export function useCreateIsolate(otuId: string) {
	const queryClient = useQueryClient();

	return useMutation<
		OtuIsolate,
		Error,
		{ otuId: string; sourceType: string; sourceName: string }
	>({
		mutationFn: ({ otuId, sourceType, sourceName }) =>
			createIsolateFn({
				data: { otuId, default: false, sourceType, sourceName },
			}) as Promise<OtuIsolate>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for setting an isolate as the default resource for an OTU
 *
 * @returns A mutator for setting an isolate as the default resource for an OTU
 */
export function useSetIsolateAsDefault() {
	const queryClient = useQueryClient();

	return useMutation<OtuIsolate, Error, { otuId: string; isolateId: string }>({
		mutationFn: ({ otuId, isolateId }) =>
			setIsolateAsDefaultFn({
				data: { otuId, isolateId },
			}) as Promise<OtuIsolate>,
		onSuccess: (_, { otuId }) => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for editing an OTU isolate
 *
 * @returns A mutator for editing an OTU isolate
 */
export function useUpdateIsolate() {
	const queryClient = useQueryClient();

	return useMutation<
		OtuIsolate,
		Error,
		{
			otuId: string;
			isolateId: string;
			sourceType: string;
			sourceName: string;
		}
	>({
		mutationFn: ({ otuId, isolateId, sourceType, sourceName }) =>
			updateIsolateFn({
				data: { otuId, isolateId, sourceType, sourceName },
			}) as Promise<OtuIsolate>,
		onSuccess: (_, { otuId }) => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for deleting an OTU isolate
 *
 * @returns A mutator for deleting an OTU isolate
 */
export function useDeleteIsolate() {
	const queryClient = useQueryClient();

	return useMutation<null, Error, { otuId: string; isolateId: string }>({
		mutationFn: ({ otuId, isolateId }) =>
			deleteIsolateFn({ data: { otuId, isolateId } }) as Promise<null>,
		onSuccess: (_, { otuId }) => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for adding a sequence
 *
 * @returns A mutator for adding a sequence
 */
export function useCreateSequence(otuId: string) {
	const queryClient = useQueryClient();

	return useMutation<
		OtuSequence,
		Error,
		{
			isolateId: string;
			accession: string;
			definition: string;
			host: string;
			sequence: string;
			segment?: string | null;
		}
	>({
		mutationFn: ({
			isolateId,
			accession,
			definition,
			host,
			sequence,
			segment,
		}) =>
			createSequenceFn({
				data: {
					otuId,
					isolateId,
					accession,
					definition,
					host,
					segment: segment ?? null,
					sequence,
				},
			}) as Promise<OtuSequence>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for editing a sequence
 *
 * @returns A mutator for editing a sequence
 */
export function useEditSequence(otuId: string) {
	const queryClient = useQueryClient();

	return useMutation<
		OtuSequence,
		Error,
		{
			sequenceId: string;
			isolateId: string;
			accession: string;
			definition: string;
			host: string;
			sequence: string;
			segment?: string | null;
		}
	>({
		mutationFn: ({
			isolateId,
			sequenceId,
			accession,
			definition,
			host,
			sequence,
			segment,
		}) =>
			updateSequenceFn({
				data: {
					otuId,
					isolateId,
					sequenceId,
					accession,
					definition,
					host,
					segment: segment ?? null,
					sequence,
				},
			}) as Promise<OtuSequence>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}

/**
 * Initializes a mutator for deleting a sequence
 *
 * @returns A mutator for deleting a sequence
 */
export function useDeleteSequence(otuId: string) {
	const queryClient = useQueryClient();

	return useMutation<
		null,
		Error,
		{ otuId: string; isolateId: string; sequenceId: string }
	>({
		mutationFn: ({ otuId, isolateId, sequenceId }) =>
			deleteSequenceFn({
				data: { otuId, isolateId, sequenceId },
			}) as Promise<null>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: otuQueryKeys.detail(otuId),
			});
		},
	});
}
