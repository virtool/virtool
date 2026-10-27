import {
	type RecentAuthentication,
	recentAuthenticationQueryOptions,
} from "@account/recentAuthentication";
import { getRecentAuthenticationRemainingFn } from "@server/auth/recentAuthentication";
import { isServer, type QueryClient } from "@tanstack/react-query";

function isFresh({ freshUntil }: RecentAuthentication): boolean {
	return Date.now() < freshUntil;
}

/**
 * Resolve whether the current session is fresh enough to enter administration.
 *
 * A session's freshness only changes when a new sign-in or challenge replaces
 * it, so a cached deadline that has not passed is trusted without a request.
 * One that has passed is refetched, because a challenge passed in another tab
 * may have replaced the session since.
 *
 * A server render answers without caching, because the cached deadline is
 * measured on the browser's clock.
 */
export async function resolveRecentAuthenticationFresh(
	queryClient: QueryClient,
): Promise<boolean> {
	if (isServer) {
		return (await getRecentAuthenticationRemainingFn()) > 0;
	}

	const options = recentAuthenticationQueryOptions();
	const cached = queryClient.getQueryData(options.queryKey);

	if (cached && isFresh(cached)) {
		return true;
	}

	return isFresh(await queryClient.fetchQuery({ ...options, staleTime: 0 }));
}
