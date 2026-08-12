import { settingsQueryKeys } from "@administration/keys";
import type { Settings } from "@administration/types";
import { referenceQueryKeys } from "@references/keys";
import {
	addReferenceGroupFn,
	addReferenceUserFn,
	archiveReferenceFn,
	createReferenceFn,
	findReferencesFn,
	getReferenceFn,
	removeReferenceGroupFn,
	removeReferenceUserFn,
	unarchiveReferenceFn,
	updateReferenceFn,
	updateReferenceGroupFn,
	updateReferenceUserFn,
} from "@server/references/functions";
import { updateSettingsFn } from "@server/settings/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { postUpload } from "@uploads/uploader";
import type {
	Reference,
	ReferenceGroup,
	ReferenceRights,
	ReferenceSearchResult,
	ReferenceUpdateRequest,
	ReferenceUser,
} from "@virtool/contracts";
import { useState } from "react";

/** A reference member is either a user or a group. */
export type ReferenceMemberNoun = "user" | "group";

/**
 * Query options for a paginated list of references.
 *
 * @param page - The page to fetch
 * @param perPage - The number of references to fetch per page
 * @param term - The search term to filter references by
 * @param archived - Lifecycle filter; `true` for archived only, `false` for active only
 */
export function referencesQueryOptions(
	page: number,
	perPage: number,
	term: string,
	archived?: boolean,
) {
	return queryOptions<ReferenceSearchResult, Error>({
		queryKey: referenceQueryKeys.list([page, perPage, term, archived]),
		queryFn: () =>
			findReferencesFn({
				data: { page, perPage, term, archived },
			}) as Promise<ReferenceSearchResult>,
	});
}

/**
 * Fetch a paginated list of references, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the reference list route, whose loader prefetches the page —
 * loading and errors are handled by the route's Suspense and `errorComponent`
 * rather than inline.
 */
export function useSuspenseReferences(
	page: number,
	perPage: number,
	term: string,
	archived?: boolean,
) {
	return useSuspenseQuery(
		referencesQueryOptions(page, perPage, term, archived),
	);
}

/**
 * Initializes a mutator for cloning a reference
 *
 * @returns A mutator for cloning a reference
 */
export function useCloneReference() {
	const queryClient = useQueryClient();

	return useMutation<
		Reference,
		Error,
		{ name: string; description: string; refId: number }
	>({
		mutationFn: ({ name, description, refId }) =>
			createReferenceFn({
				data: { name, description, cloneFrom: refId },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.lists(),
			});
		},
	});
}

/**
 * Initializes a mutator for importing a reference
 *
 * @returns A mutator for importing a reference
 */
export function useImportReference() {
	const queryClient = useQueryClient();

	return useMutation<
		Reference,
		Error,
		{ name: string; description: string; importFrom: number }
	>({
		mutationFn: ({ name, description, importFrom }) =>
			createReferenceFn({
				data: { name, description, importFrom },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.lists(),
			});
		},
	});
}

/**
 * Initializes a mutator for uploading a reference
 *
 * @returns The mutator, file information, and progress of the reference upload
 */
export function useUploadReference() {
	const [fileName, setFileName] = useState("");
	const [uploadId, setUploadId] = useState<number | null>(null);
	const [progress, setProgress] = useState(0);

	const uploadMutation = useMutation({
		mutationFn: (file: File) =>
			postUpload(file, file.name, "reference", ({ percent }) => {
				setProgress(percent);
			}).then((upload) => {
				setFileName(upload.name);
				setUploadId(upload.id);
			}),
		onMutate: () => {
			setFileName("");
			setUploadId(null);
			setProgress(0);
		},
	});

	return { uploadMutation, fileName, uploadId, progress };
}

/**
 * Initializes a mutator for creating an empty reference
 *
 * @returns A mutator for creating an empty reference
 */
export function useCreateReference() {
	const queryClient = useQueryClient();

	return useMutation<
		Reference,
		Error,
		{ name: string; description: string; organism: string }
	>({
		mutationFn: ({ name, description, organism }) =>
			createReferenceFn({
				data: { name, description, organism },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.lists(),
			});
		},
	});
}

/**
 * Initializes a mutator for updating a reference
 *
 * @returns A mutator for updating a reference
 */
export function useUpdateReference(refId: number, onSuccess?: () => void) {
	const queryClient = useQueryClient();

	const mutation = useMutation<Reference, Error, ReferenceUpdateRequest>({
		mutationFn: (data) =>
			updateReferenceFn({
				data: { referenceId: refId, ...data },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient
				.invalidateQueries({
					queryKey: referenceQueryKeys.detail(refId),
				})
				.then(() => onSuccess?.());
		},
	});

	return { mutation };
}

/**
 * Initializes a mutator for replacing a reference's allowed source types
 *
 * @param refId - The id of the reference to update
 * @returns A mutator that takes the complete new list of source types
 */
export function useUpdateReferenceSourceTypes(refId: number) {
	const queryClient = useQueryClient();

	return useMutation<Reference, Error, string[]>({
		mutationFn: (sourceTypes) =>
			updateReferenceFn({
				data: { referenceId: refId, sourceTypes },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.detail(refId),
			});
		},
	});
}

/**
 * Initializes a mutator for replacing the source types new references start with
 *
 * @returns A mutator that takes the complete new list of default source types
 */
export function useUpdateDefaultSourceTypes() {
	const queryClient = useQueryClient();

	return useMutation<Settings, Error, string[]>({
		mutationFn: (sourceTypes) =>
			updateSettingsFn({ data: { defaultSourceTypes: sourceTypes } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for adding members to a reference
 *
 * @param refId - The reference to add the member to
 * @param noun - Whether the member is a user or a group
 * @returns A mutator for adding members to a reference
 */
export function useAddReferenceMember(
	refId: number,
	noun: ReferenceMemberNoun,
) {
	const queryClient = useQueryClient();

	return useMutation<ReferenceUser | ReferenceGroup, Error, { id: number }>({
		mutationFn: ({ id }) =>
			noun === "user"
				? (addReferenceUserFn({
						data: { referenceId: refId, userId: id },
					}) as Promise<ReferenceUser>)
				: (addReferenceGroupFn({
						data: { referenceId: refId, groupId: id },
					}) as Promise<ReferenceGroup>),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.detail(refId),
			});
		},
	});
}

/**
 * Initializes a mutator for updating a reference members modifying rights
 *
 * @param noun - Whether the member is a user or a group
 * @returns A mutator for updating a reference members modifying rights
 */
export function useUpdateReferenceMember(noun: ReferenceMemberNoun) {
	return useMutation<
		ReferenceUser | ReferenceGroup,
		Error,
		{ refId: number; id: number; update: Partial<ReferenceRights> }
	>({
		mutationFn: ({ refId, id, update }) =>
			noun === "user"
				? (updateReferenceUserFn({
						data: { referenceId: refId, userId: id, ...update },
					}) as Promise<ReferenceUser>)
				: (updateReferenceGroupFn({
						data: { referenceId: refId, groupId: id, ...update },
					}) as Promise<ReferenceGroup>),
	});
}

/**
 * Initializes a mutator for removing members from a reference
 *
 * @param refId - The reference to remove the member from
 * @param noun - Whether the member is a user or a group
 * @returns A mutator for removing members from a reference
 */
export function useRemoveReferenceUser(
	refId: number,
	noun: ReferenceMemberNoun,
) {
	const queryClient = useQueryClient();

	return useMutation<null, Error, { id: number }>({
		mutationFn: ({ id }) =>
			noun === "user"
				? (removeReferenceUserFn({
						data: { referenceId: refId, userId: id },
					}) as Promise<null>)
				: (removeReferenceGroupFn({
						data: { referenceId: refId, groupId: id },
					}) as Promise<null>),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.detail(refId),
			});
		},
	});
}

export function referenceQueryOptions(refId: number) {
	return queryOptions<Reference, Error>({
		queryKey: referenceQueryKeys.detail(refId),
		queryFn: () =>
			getReferenceFn({ data: { referenceId: refId } }) as Promise<Reference>,
	});
}

/**
 * Get a reference by its id
 *
 * @param refId - The id of the reference to get
 * @returns Query results containing the reference
 */
export function useFetchReference(refId: number) {
	return useQuery(referenceQueryOptions(refId));
}

/**
 * Fetch a reference, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the `$refId` detail route, whose loader prefetches the
 * reference — loading and errors are handled by the route's Suspense and
 * `errorComponent` rather than inline.
 */
export function useSuspenseReference(refId: number) {
	return useSuspenseQuery(referenceQueryOptions(refId));
}

/**
 * Initializes a mutator for archiving a reference
 *
 * @param refId - The id of the reference to archive
 * @returns A mutator for archiving the reference
 */
export function useArchiveReference(refId: number) {
	const queryClient = useQueryClient();

	return useMutation<Reference, Error, void>({
		mutationFn: () =>
			archiveReferenceFn({
				data: { referenceId: refId },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.detail(refId),
			});
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.lists(),
			});
		},
	});
}

/**
 * Initializes a mutator for unarchiving a reference
 *
 * @param refId - The id of the reference to unarchive
 * @returns A mutator for unarchiving the reference
 */
export function useUnarchiveReference(refId: number) {
	const queryClient = useQueryClient();

	return useMutation<Reference, Error, void>({
		mutationFn: () =>
			unarchiveReferenceFn({
				data: { referenceId: refId },
			}) as Promise<Reference>,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.detail(refId),
			});
			queryClient.invalidateQueries({
				queryKey: referenceQueryKeys.lists(),
			});
		},
	});
}
