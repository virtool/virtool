import { buildCreateOtuCommandFromDraft } from "@otus-v2/command";
import { otuV2QueryKeys } from "@otus-v2/keys";
import {
	createLocalOtuFn,
	getGenbankOtuDraftFn,
	getLocalOtuFn,
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
	GenbankOtuDraft,
	LocalOtuV2,
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
	return queryOptions<LocalOtuV2, Error>({
		queryKey: otuV2QueryKeys.detail(otuId),
		queryFn: () =>
			getLocalOtuFn({
				data: { referenceId, otuId },
			}) as Promise<LocalOtuV2>,
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
			queryClient.setQueryData(otuV2QueryKeys.detail(otu.id), otu);
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
			queryClient.setQueryData(otuV2QueryKeys.detail(otu.id), otu);
			queryClient.invalidateQueries({
				queryKey: otuV2QueryKeys.list([referenceId]),
			});
		},
	});
}
