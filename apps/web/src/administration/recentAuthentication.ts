import { accountQueryKeys } from "@account/keys";
import { getRecentAuthenticationRemainingFn } from "@server/auth/recentAuthentication";
import { isServer, type QueryClient } from "@tanstack/react-query";

/** A session's freshness deadline, in epoch milliseconds on the local clock. */
type RecentAuthentication = {
	freshUntil: number;
};

function isFresh({ freshUntil }: RecentAuthentication): boolean {
	return Date.now() < freshUntil;
}

/**
 * Resolve whether the current session is fresh enough to enter administration.
 *
 * The server reports the time remaining rather than the session's creation
 * instant so the deadline is measured on this browser's clock, however far it
 * drifts from the server's. A session's freshness only changes when a new
 * sign-in or challenge replaces it, so a cached deadline that has not passed
 * is trusted without a request. One that has passed is refetched, because a
 * challenge passed in another tab may have replaced the session since.
 *
 * A server render answers without caching: a deadline measured on the server's
 * clock would be dehydrated and then compared against the browser's.
 */
export async function resolveRecentAuthenticationFresh(
	queryClient: QueryClient,
): Promise<boolean> {
	if (isServer) {
		return (await getRecentAuthenticationRemainingFn()) > 0;
	}

	const queryKey = accountQueryKeys.recentAuthentication();
	const cached = queryClient.getQueryData<RecentAuthentication>(queryKey);

	if (cached && isFresh(cached)) {
		return true;
	}

	const latest = await queryClient.fetchQuery({
		queryKey,
		queryFn: async (): Promise<RecentAuthentication> => {
			const remaining = await getRecentAuthenticationRemainingFn();
			return { freshUntil: Date.now() + remaining };
		},
		staleTime: 0,
	});

	return isFresh(latest);
}
