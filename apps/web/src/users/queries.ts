import {
	createUserFn,
	findUsersFn,
	getUserFn,
	listUsersFn,
	searchUsersFn,
	setAdministratorRoleFn,
	updateUserFn,
} from "@server/users/functions";
import {
	keepPreviousData,
	queryOptions,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { userQueryKeys } from "@users/keys";
import type { AdministratorRoleName, UserNested } from "@virtool/contracts";

/**
 * Fetch every active user, for populating selectors and filters
 *
 * @returns A list of users with their ids and handles
 */
export function useListUsers() {
	return useQuery<UserNested[]>({
		queryKey: userQueryKeys.nested(),
		queryFn: () => listUsersFn(),
	});
}

/**
 * Setup query for fetching user search results for infinite scrolling view
 *
 * @param perPage - The number of users to fetch per page
 * @param term - The search term to filter users by
 * @returns An UseInfiniteQueryResult object containing the user search results
 */
export function useInfiniteFindUsers(perPage: number, term: string) {
	return useInfiniteQuery({
		queryKey: userQueryKeys.infiniteList([perPage, term]),
		queryFn: ({ pageParam }) =>
			searchUsersFn({ data: { page: pageParam as number, perPage, term } }),
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
 * Query options for a page of user search results.
 *
 * @param page - The page to fetch
 * @param perPage - The number of users to fetch per page
 * @param term - The search term to filter users by
 * @param administrator - Filter the users by administrator status
 * @param active - Filter the users by whether they are active
 */
export function usersQueryOptions(
	page: number,
	perPage: number,
	term: string,
	administrator?: boolean,
	active?: boolean,
) {
	return queryOptions({
		queryKey: userQueryKeys.list([page, perPage, term, administrator, active]),
		queryFn: () =>
			findUsersFn({
				data: { page, perPage, term, administrator, active },
			}),
	});
}

/**
 * Fetch a page of user search results, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary instead of resolving to `undefined`. Use this from components
 * rendered under the user administration route, whose loader prefetches the
 * page — loading and errors are handled by the route's Suspense and
 * `errorComponent` rather than inline.
 */
export function useSuspenseUsers(
	page: number,
	perPage: number,
	term: string,
	administrator?: boolean,
	active?: boolean,
) {
	return useSuspenseQuery(
		usersQueryOptions(page, perPage, term, administrator, active),
	);
}

/**
 * Initializes a mutator for creating a user
 *
 * @returns A mutator for creating a user
 */
export function useCreateUser() {
	const queryClient = useQueryClient();
	return useMutation<
		Awaited<ReturnType<typeof createUserFn>>,
		Error,
		{
			handle: string;
			password: string;
			forceReset: boolean;
		}
	>({
		mutationFn: ({ handle, password, forceReset }) =>
			createUserFn({ data: { handle, password, forceReset } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
		},
	});
}

/**
 * Query options for a single user.
 *
 * @param userId - The id of the user to fetch
 */
export function userQueryOptions(userId: number) {
	return queryOptions({
		queryKey: userQueryKeys.detail(userId),
		queryFn: () => getUserFn({ data: { userId } }),
	});
}

/**
 * Fetches a single user, suspending until it resolves.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary. Use this from components rendered under a route whose loader
 * prefetches the user.
 *
 * @param userId - The id of the user to fetch
 */
export function useSuspenseUser(userId: number) {
	return useSuspenseQuery(userQueryOptions(userId));
}

/** Values accepted when updating a user from the administration views. */
export type UserUpdate = {
	active?: boolean;
	forceReset?: boolean;
	handle?: string;
	password?: string;
	groups?: number[];
	primaryGroup?: number | null;
};

/**
 * Initializes a mutator for updating a user.
 *
 * @returns A mutator for updating a user
 */
export function useUpdateUser() {
	const queryClient = useQueryClient();
	return useMutation<
		Awaited<ReturnType<typeof updateUserFn>>,
		Error,
		{ userId: number; update: UserUpdate }
	>({
		mutationFn: ({ userId, update }) =>
			updateUserFn({ data: { userId, ...update } }),
		onSuccess: (result) => {
			if (result) {
				queryClient.setQueryData(userQueryKeys.detail(result.id), result);
			}
			queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
		},
	});
}

/**
 * Set up a query for updating users administrator roles
 *
 * @returns A mutator for updating a users administrator role
 */
export function useSetAdministratorRole() {
	const queryClient = useQueryClient();
	return useMutation<
		Awaited<ReturnType<typeof setAdministratorRoleFn>>,
		Error,
		{ role: AdministratorRoleName | null; user_id: number }
	>({
		mutationFn: ({ role, user_id }) =>
			setAdministratorRoleFn({ data: { userId: user_id, role } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userQueryKeys.all() });
		},
	});
}
