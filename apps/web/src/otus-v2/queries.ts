import { buildCreateOtuCommandFromDraft } from "@otus-v2/command";
import { otuV2QueryKeys } from "@otus-v2/keys";
import {
	createLocalOtuFn,
	createLocalOtuIsolateFn,
	deleteLocalOtuFn,
	getGenbankIsolateDraftFn,
	getGenbankOtuDraftFn,
	getLocalOtuFn,
	getLocalOtuIsolateFn,
	getLocalOtuIsolatesFn,
	getLocalOtuSequenceFn,
	getLocalOtusFn,
} from "@server/otus-v2/functions";
import {
	queryOptions,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	CreateLocalOtuCommandInput,
	CreateLocalOtuIsolateCommandInput,
	DeleteLocalOtuCommandInput,
	GenbankIsolateDraft,
	GenbankOtuDraft,
	LocalOtuV2,
	LocalOtuV2IsolateDetail,
	LocalOtuV2IsolateSummary,
	LocalOtuV2Overview,
	LocalOtuV2Sequence,
	LocalOtuV2Summary,
} from "@virtool/contracts";

/**
 * Query options for the local v2 OTUs in a Reference.
 *
 * @param referenceId - The UUID of the parent Reference
 */
export function localOtusV2QueryOptions(referenceId: string) {
	return queryOptions<LocalOtuV2Summary[], Error>({
		queryKey: otuV2QueryKeys.list([referenceId]),
		queryFn: () =>
			getLocalOtusFn({
				data: { referenceId },
			}) as Promise<LocalOtuV2Summary[]>,
	});
}

/** Fetch the local v2 OTUs in a Reference, suspending until they resolve. */
export function useSuspenseLocalOtusV2(referenceId: string) {
	return useSuspenseQuery(localOtusV2QueryOptions(referenceId));
}

/**
 * Query options for a single local v2 OTU.
 *
 * @param referenceId - The UUID of the parent Reference
 * @param otuId - The UUID of the OTU to fetch
 */
export function localOtuV2QueryOptions(referenceId: string, otuId: string) {
	return queryOptions<LocalOtuV2Overview, Error>({
		queryKey: otuV2QueryKeys.detail(otuId),
		queryFn: () =>
			getLocalOtuFn({
				data: { referenceId, otuId },
			}) as Promise<LocalOtuV2Overview>,
	});
}

/**
 * Fetch a local v2 OTU, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary. Use this from components under the `$otuId` detail route,
 * whose loader prefetches the OTU.
 */
export function useSuspenseLocalOtuV2(referenceId: string, otuId: string) {
	return useSuspenseQuery(localOtuV2QueryOptions(referenceId, otuId));
}

export function localOtuV2IsolatesQueryOptions(
	referenceId: string,
	otuId: string,
) {
	return queryOptions<LocalOtuV2IsolateSummary[], Error>({
		queryKey: [...otuV2QueryKeys.detail(otuId), "isolates"],
		queryFn: () =>
			getLocalOtuIsolatesFn({
				data: { referenceId, otuId },
			}) as Promise<LocalOtuV2IsolateSummary[]>,
	});
}

export function useSuspenseLocalOtuV2Isolates(
	referenceId: string,
	otuId: string,
) {
	return useSuspenseQuery(localOtuV2IsolatesQueryOptions(referenceId, otuId));
}

export function localOtuV2IsolateQueryOptions(
	referenceId: string,
	otuId: string,
	isolateId: string,
) {
	return queryOptions<LocalOtuV2IsolateDetail, Error>({
		queryKey: [...otuV2QueryKeys.detail(otuId), "isolates", isolateId],
		queryFn: () =>
			getLocalOtuIsolateFn({
				data: { referenceId, otuId, isolateId },
			}) as Promise<LocalOtuV2IsolateDetail>,
	});
}

export function useSuspenseLocalOtuV2Isolate(
	referenceId: string,
	otuId: string,
	isolateId: string,
) {
	return useSuspenseQuery(
		localOtuV2IsolateQueryOptions(referenceId, otuId, isolateId),
	);
}

export function localOtuV2SequenceQueryOptions(
	referenceId: string,
	otuId: string,
	isolateId: string,
	sequenceId: string,
) {
	return queryOptions<LocalOtuV2Sequence, Error>({
		queryKey: [
			...otuV2QueryKeys.detail(otuId),
			"isolates",
			isolateId,
			"sequences",
			sequenceId,
		],
		queryFn: () =>
			getLocalOtuSequenceFn({
				data: { referenceId, otuId, isolateId, sequenceId },
			}) as Promise<LocalOtuV2Sequence>,
	});
}

function cacheLocalOtuOverview(
	queryClient: ReturnType<typeof useQueryClient>,
	otu: LocalOtuV2,
) {
	const overview: LocalOtuV2Overview = {
		...otu,
		isolates: otu.isolates.slice(0, 5).map(({ id, name }) => ({ id, name })),
		isolateCount: otu.isolates.length,
	};
	queryClient.setQueryData(otuV2QueryKeys.detail(otu.id), overview);
}

/**
 * Initializes a mutator for creating one complete local v2 OTU.
 *
 * The caller assembles the entire `CreateOTU` command — every UUID included —
 * before submitting; the server receives one complete command.
 *
 * @param referenceId - The UUID of the Reference the OTU is created in
 * @returns A mutator that takes the command and resolves the assembled OTU
 */
export function useCreateLocalOtu(referenceId: string) {
	const queryClient = useQueryClient();

	return useMutation<LocalOtuV2, Error, CreateLocalOtuCommandInput>({
		mutationFn: (command) =>
			createLocalOtuFn({
				data: { referenceId, command },
			}) as Promise<LocalOtuV2>,
		onSuccess: (otu) => {
			cacheLocalOtuOverview(queryClient, otu);
			queryClient.invalidateQueries({
				queryKey: otuV2QueryKeys.list([referenceId]),
			});
		},
	});
}

/** Fetch an NCBI isolate preview for an existing OTU. */
export function useGenbankIsolateDraft(referenceId: string, otuId: string) {
	return useMutation<GenbankIsolateDraft, Error, string[]>({
		mutationFn: (accessions) =>
			getGenbankIsolateDraftFn({
				data: { referenceId, otuId, accessions },
			}) as Promise<GenbankIsolateDraft>,
	});
}

/** Add a reviewed isolate to an existing OTU. */
export function useCreateLocalOtuIsolate(referenceId: string) {
	const queryClient = useQueryClient();
	return useMutation<LocalOtuV2, Error, CreateLocalOtuIsolateCommandInput>({
		mutationFn: (command) =>
			createLocalOtuIsolateFn({
				data: { referenceId, command },
			}) as Promise<LocalOtuV2>,
		onSuccess: (otu) => {
			cacheLocalOtuOverview(queryClient, otu);
			queryClient.invalidateQueries({
				queryKey: [...otuV2QueryKeys.detail(otu.id), "isolates"],
			});
			queryClient.invalidateQueries({
				queryKey: otuV2QueryKeys.list([referenceId]),
			});
		},
	});
}

/** Delete a local v2 OTU at its current version. */
export function useDeleteLocalOtu(referenceId: string) {
	const queryClient = useQueryClient();
	return useMutation<null, Error, DeleteLocalOtuCommandInput>({
		mutationFn: (command) =>
			deleteLocalOtuFn({ data: { referenceId, command } }) as Promise<null>,
		onSuccess: (_result, command) => {
			queryClient.removeQueries({
				queryKey: otuV2QueryKeys.detail(command.otuId),
			});
			queryClient.invalidateQueries({
				queryKey: otuV2QueryKeys.list([referenceId]),
			});
		},
	});
}

/**
 * Initializes a mutator that creates a local v2 OTU from NCBI accessions.
 *
 * The server resolves the accessions into a draft; this mints every UUID,
 * applies the Reference's default segment length tolerance, and writes the
 * assembled command through the same create path as {@link useCreateLocalOtu}.
 *
 * @param referenceId - The UUID of the Reference the OTU is created in
 * @param defaultSegmentLengthTolerance - The tolerance applied to each segment
 * @returns A mutator that takes the accessions and resolves the assembled OTU
 */
export function useCreateLocalOtuFromAccessions(
	referenceId: string,
	defaultSegmentLengthTolerance: number,
) {
	const queryClient = useQueryClient();

	return useMutation<LocalOtuV2, Error, string[]>({
		mutationFn: async (accessions) => {
			const draft = (await getGenbankOtuDraftFn({
				data: { referenceId, accessions },
			})) as GenbankOtuDraft;

			const command = buildCreateOtuCommandFromDraft(
				draft,
				defaultSegmentLengthTolerance,
			);

			return createLocalOtuFn({
				data: { referenceId, command },
			}) as Promise<LocalOtuV2>;
		},
		onSuccess: (otu) => {
			cacheLocalOtuOverview(queryClient, otu);
			queryClient.invalidateQueries({
				queryKey: otuV2QueryKeys.list([referenceId]),
			});
		},
	});
}
