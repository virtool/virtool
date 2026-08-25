import { referenceV2QueryKeys } from "@references-v2/keys";
import {
	createReferenceV2Fn,
	getReferencesV2Fn,
	getReferenceV2Fn,
} from "@server/references-v2/functions";
import {
	queryOptions,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { ReferenceV2, ReferenceV2CreateRequest } from "@virtool/contracts";

/**
 * Query options for a single v2 Reference.
 *
 * @param referenceId - The UUID of the Reference to fetch
 */
export function referenceV2QueryOptions(referenceId: string) {
	return queryOptions<ReferenceV2, Error>({
		queryKey: referenceV2QueryKeys.detail(referenceId),
		queryFn: () =>
			getReferenceV2Fn({
				data: { referenceId },
			}) as Promise<ReferenceV2>,
	});
}

/** Query options for the visible v2 References. */
export function referencesV2QueryOptions() {
	return queryOptions<ReferenceV2[], Error>({
		queryKey: referenceV2QueryKeys.list([]),
		queryFn: () => getReferencesV2Fn() as Promise<ReferenceV2[]>,
	});
}

/** Fetch the visible v2 References, suspending until they resolve. */
export function useSuspenseReferencesV2() {
	return useSuspenseQuery(referencesV2QueryOptions());
}

/**
 * Fetch a v2 Reference, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary. Use this from components under the `$referenceId` detail
 * route, whose loader prefetches the Reference.
 */
export function useSuspenseReferenceV2(referenceId: string) {
	return useSuspenseQuery(referenceV2QueryOptions(referenceId));
}

/**
 * Initializes a mutator for creating a local v2 Reference.
 *
 * @returns A mutator that takes the create request and resolves the new Reference
 */
export function useCreateReferenceV2() {
	const queryClient = useQueryClient();

	return useMutation<ReferenceV2, Error, ReferenceV2CreateRequest>({
		mutationFn: (data) => createReferenceV2Fn({ data }) as Promise<ReferenceV2>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.lists(),
			});
		},
	});
}
