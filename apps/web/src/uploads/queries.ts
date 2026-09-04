import {
	deleteUploadFn,
	findUploadsFn,
	getUploadPolicyFn,
} from "@server/uploads/functions";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { fileQueryKeys } from "@uploads/keys";
import type {
	SortDirection,
	UploadPolicy,
	UploadSearchResult,
	UploadSortField,
	UploadType,
} from "@virtool/contracts";

/**
 * Fetch the maximum upload size, so a drop zone can refuse an oversized file
 * before any of its bytes are transferred.
 *
 * The server enforces the same limit at initialization and is the authority;
 * this only spares the user a failed upload.
 */
export function useUploadPolicy() {
	return useQuery<UploadPolicy>({
		queryKey: [...fileQueryKeys.all(), "policy"],
		queryFn: () => getUploadPolicyFn(),
	});
}

export function useListFiles(
	type: UploadType,
	page: number,
	perPage: number,
	sort: UploadSortField | undefined,
	direction: SortDirection,
) {
	return useQuery<UploadSearchResult>({
		queryKey: fileQueryKeys.list([type, page, perPage, sort, direction]),
		queryFn: () =>
			findUploadsFn({
				data: { uploadType: type, page, perPage, sort, direction },
			}),
		placeholderData: keepPreviousData,
	});
}

export function useInfiniteFindFiles(type: UploadType, perPage: number) {
	return useInfiniteQuery<UploadSearchResult>({
		queryKey: fileQueryKeys.infiniteList([type, perPage]),
		queryFn: ({ pageParam }) =>
			findUploadsFn({
				data: { uploadType: type, page: pageParam as number, perPage },
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			if (lastPage.page >= lastPage.pageCount) {
				return undefined;
			}
			return (lastPage.page || 1) + 1;
		},
	});
}

/**
 * Initializes a mutator for deleting a file
 *
 * @returns A mutator for deleting a file
 */
export function useDeleteFile() {
	return useMutation<null, unknown, { id: number }>({
		mutationFn: ({ id }) => deleteUploadFn({ data: { id } }),
	});
}

/**
 * Initializes a mutator for deleting several files at once
 *
 * @returns A mutator for deleting several files
 */
export function useDeleteFiles() {
	const queryClient = useQueryClient();

	return useMutation<void, unknown, { ids: number[] }>({
		mutationFn: async ({ ids }) => {
			// Every request has to finish before the mutation settles. Rejecting on
			// the first failure would let the list refetch while the rest are still
			// in flight, so files that did get deleted would linger in the list.
			const results = await Promise.allSettled(
				ids.map((id) => deleteUploadFn({ data: { id } })),
			);

			const failure = results.find((result) => result.status === "rejected");

			if (failure) {
				throw failure.reason;
			}
		},
		// Settled, not success: a partial failure still removed some of the files,
		// so the list has to be refreshed either way.
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: fileQueryKeys.lists() });
		},
	});
}
