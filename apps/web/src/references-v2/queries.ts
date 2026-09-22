import { referenceV2QueryKeys } from "@references-v2/keys";
import {
	addReferenceV2GroupFn,
	addReferenceV2UserFn,
	archiveReferenceV2Fn,
	createReferenceV2Fn,
	deleteReferenceV2Fn,
	getReferencesV2Fn,
	getReferenceV2Fn,
	removeReferenceV2GroupFn,
	removeReferenceV2UserFn,
	unarchiveReferenceV2Fn,
	updateReferenceV2Fn,
	updateReferenceV2GroupFn,
	updateReferenceV2UserFn,
} from "@server/references-v2/functions";
import {
	queryOptions,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	ReferenceV2,
	ReferenceV2CreateRequest,
	ReferenceV2Group,
	ReferenceV2Rights,
	ReferenceV2UpdateRequest,
	ReferenceV2User,
} from "@virtool/contracts";

/** A kind of member that can be granted v2 Reference rights. */
export type ReferenceV2MemberNoun = "user" | "group";

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

/** Update local Reference metadata at the version shown to the editor. */
export function useUpdateReferenceV2(referenceId: string) {
	const queryClient = useQueryClient();
	return useMutation<ReferenceV2, Error, ReferenceV2UpdateRequest>({
		mutationFn: (update) =>
			updateReferenceV2Fn({
				data: { referenceId, update },
			}) as Promise<ReferenceV2>,
		onSuccess: (reference) => {
			queryClient.setQueryData(
				referenceV2QueryKeys.detail(referenceId),
				reference,
			);
			queryClient.invalidateQueries({ queryKey: referenceV2QueryKeys.lists() });
		},
		onError: () => {
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.detail(referenceId),
			});
		},
	});
}

/** Initializes a mutator for permanently deleting a v2 Reference. */
export function useDeleteReferenceV2() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, string>({
		mutationFn: (referenceId) =>
			deleteReferenceV2Fn({ data: { referenceId } }) as Promise<void>,
		onSuccess: (_data, referenceId) => {
			queryClient.removeQueries({
				queryKey: referenceV2QueryKeys.detail(referenceId),
			});
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.lists(),
			});
		},
	});
}

/** Initialize a mutator for archiving or unarchiving a v2 Reference. */
export function useSetReferenceV2Archived(
	referenceId: string,
	archived: boolean,
) {
	const queryClient = useQueryClient();

	return useMutation<ReferenceV2, Error, void>({
		mutationFn: () =>
			(archived ? archiveReferenceV2Fn : unarchiveReferenceV2Fn)({
				data: { referenceId },
			}) as Promise<ReferenceV2>,
		onSuccess: (reference) => {
			queryClient.setQueryData(
				referenceV2QueryKeys.detail(referenceId),
				reference,
			);
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.lists(),
			});
		},
	});
}

/** Add a user or group to a v2 Reference. */
export function useAddReferenceV2Member(
	referenceId: string,
	noun: ReferenceV2MemberNoun,
) {
	const queryClient = useQueryClient();
	return useMutation<ReferenceV2User | ReferenceV2Group, Error, number>({
		mutationFn: (id) =>
			noun === "user"
				? (addReferenceV2UserFn({
						data: { referenceId, userId: id },
					}) as Promise<ReferenceV2User>)
				: (addReferenceV2GroupFn({
						data: { referenceId, groupId: id },
					}) as Promise<ReferenceV2Group>),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.detail(referenceId),
			});
		},
	});
}

/** Update a user or group's rights on a v2 Reference. */
export function useUpdateReferenceV2Member(
	referenceId: string,
	noun: ReferenceV2MemberNoun,
) {
	const queryClient = useQueryClient();
	return useMutation<
		ReferenceV2User | ReferenceV2Group,
		Error,
		{ id: number; update: Partial<ReferenceV2Rights> }
	>({
		mutationFn: ({ id, update }) =>
			noun === "user"
				? (updateReferenceV2UserFn({
						data: { referenceId, userId: id, ...update },
					}) as Promise<ReferenceV2User>)
				: (updateReferenceV2GroupFn({
						data: { referenceId, groupId: id, ...update },
					}) as Promise<ReferenceV2Group>),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.detail(referenceId),
			});
		},
	});
}

/** Remove a user or group from a v2 Reference. */
export function useRemoveReferenceV2Member(
	referenceId: string,
	noun: ReferenceV2MemberNoun,
) {
	const queryClient = useQueryClient();
	return useMutation<null, Error, number>({
		mutationFn: (id) =>
			noun === "user"
				? (removeReferenceV2UserFn({
						data: { referenceId, userId: id },
					}) as Promise<null>)
				: (removeReferenceV2GroupFn({
						data: { referenceId, groupId: id },
					}) as Promise<null>),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceV2QueryKeys.detail(referenceId),
			});
		},
	});
}
