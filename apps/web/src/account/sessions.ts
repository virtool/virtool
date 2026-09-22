import { accountQueryKeys } from "@account/keys";
import { useRecentlyAuthenticatedMutation } from "@app/recentAuthentication";
import {
	findActiveBrowserSessionsFn,
	revokeBrowserSessionFn,
	revokeOtherBrowserSessionsFn,
} from "@server/account/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { ActiveBrowserSession } from "@virtool/contracts";

/** Query options for the signed-in user's live browser sessions. */
export function activeBrowserSessionsQueryOptions() {
	return queryOptions<ActiveBrowserSession[]>({
		queryKey: accountQueryKeys.activeSessions(),
		queryFn: () => findActiveBrowserSessionsFn(),
	});
}

/**
 * Fetch the signed-in user's live browser sessions.
 *
 * @public
 */
export function useFetchActiveBrowserSessions() {
	return useQuery(activeBrowserSessionsQueryOptions());
}

/** Revoke one non-current browser session and refresh the committed list. */
export function useRevokeBrowserSession() {
	const queryClient = useQueryClient();
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ managementId }: { managementId: number }) =>
			revokeBrowserSessionFn({ data: { managementId } }),
	);

	return useMutation<null, Error, { managementId: number }>({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: accountQueryKeys.activeSessions(),
			});
		},
	});
}

/** Revoke every non-current browser session and refresh the committed list. */
export function useRevokeOtherBrowserSessions() {
	const queryClient = useQueryClient();
	const mutationFn = useRecentlyAuthenticatedMutation(() =>
		revokeOtherBrowserSessionsFn(),
	);

	return useMutation<{ revoked: number }, Error>({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: accountQueryKeys.activeSessions(),
			});
		},
	});
}
