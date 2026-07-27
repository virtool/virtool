import { deleteUploadFn, findUploadsFn } from "@server/uploads/functions";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { fileQueryKeys } from "@uploads/keys";
import type { FileResponse, UploadType } from "./types";

export function useListFiles(type: UploadType, page: number, per_page: number) {
	return useQuery<FileResponse>({
		queryKey: fileQueryKeys.list([type, page, per_page]),
		queryFn: () =>
			findUploadsFn({ data: { upload_type: type, page, per_page } }),
		placeholderData: keepPreviousData,
	});
}

export function useInfiniteFindFiles(type: UploadType, per_page: number) {
	return useInfiniteQuery<FileResponse>({
		queryKey: fileQueryKeys.infiniteList([type, per_page]),
		queryFn: ({ pageParam }) =>
			findUploadsFn({
				data: { upload_type: type, page: pageParam as number, per_page },
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			if (lastPage.page >= lastPage.page_count) {
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
