import { groupQueryKeys } from "@groups/keys";
import {
	createGroupFn,
	deleteGroupFn,
	findGroupsFn,
	getGroupFn,
	listGroupsFn,
	updateGroupFn,
} from "@server/groups/functions";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	Group,
	GroupMinimal,
	GroupSearchResults,
} from "@virtool/contracts";
import type { PermissionsUpdate } from "./types";

/**
 * Setup query for fetching group search results for infinite scrolling view
 *
 * @param perPage - The number of groups to fetch per page
 * @param term - The search term to filter groups by
 * @returns A paginated list of the group search results
 */
export function useInfiniteFindGroups(perPage: number, term: string) {
	return useInfiniteQuery<GroupSearchResults>({
		queryKey: groupQueryKeys.infiniteList([perPage, term]),
		queryFn: ({ pageParam }) =>
			findGroupsFn({
				data: { term, page: pageParam as number, perPage },
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			if (lastPage.page >= lastPage.pageCount) {
				return undefined;
			}
			return (lastPage.page || 1) + 1;
		},
		placeholderData: keepPreviousData,
	});
}

/**
 * Gets a non-paginated list of all groups
 *
 * @returns A non-paginated list of groups
 */
export function useListGroups() {
	return useQuery<GroupMinimal[]>({
		queryKey: groupQueryKeys.lists(),
		queryFn: () => listGroupsFn() as Promise<GroupMinimal[]>,
	});
}

/**
 * Fetches a single group
 *
 * @param id - The id of the group to fetch
 * @returns A non-paginated list of groups
 */
export function useFetchGroup(id: string | number) {
	return useQuery<Group>({
		queryKey: groupQueryKeys.detail(id),
		queryFn: () =>
			getGroupFn({ data: { groupId: Number(id) } }) as Promise<Group>,
		enabled: Boolean(id),
		placeholderData: keepPreviousData,
	});
}

/**
 * Initializes a mutator for updating a group
 *
 * @returns A mutator for updating a group
 */
export function useUpdateGroup() {
	const queryClient = useQueryClient();
	return useMutation<
		Group,
		Error,
		{
			id: string | number;
			name?: string;
			permissions?: PermissionsUpdate;
		}
	>({
		mutationFn: ({ id, name, permissions }) =>
			updateGroupFn({
				data: { groupId: Number(id), name, permissions },
			}) as Promise<Group>,
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: groupQueryKeys.lists() });
			queryClient.setQueryData(groupQueryKeys.detail(data.id), data);
		},
	});
}

/**
 * Initializes a mutator for removing a group
 *
 * @returns A mutator for removing a group
 */
export function useRemoveGroup() {
	const queryClient = useQueryClient();
	return useMutation<null, Error, { id: string | number }>({
		mutationFn: ({ id }) =>
			deleteGroupFn({ data: { groupId: Number(id) } }) as Promise<null>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: groupQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for creating a group
 *
 * @returns A mutator for creating a group
 */
export function useCreateGroup() {
	const queryClient = useQueryClient();
	return useMutation<Group, Error, { name: string }>({
		mutationFn: ({ name }) =>
			createGroupFn({ data: { name } }) as Promise<Group>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: groupQueryKeys.lists() });
		},
	});
}
