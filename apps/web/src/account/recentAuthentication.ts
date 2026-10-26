import { accountQueryKeys } from "@account/keys";
import { getRecentAuthenticationRemainingFn } from "@server/auth/recentAuthentication";
import { queryOptions } from "@tanstack/react-query";

/** A session's freshness deadline, in epoch milliseconds on the local clock. */
export type RecentAuthentication = {
	freshUntil: number;
};

/**
 * Query options for the current session's freshness deadline.
 *
 * The server reports the time remaining rather than the session's creation
 * instant so the deadline is measured on this browser's clock, however far it
 * drifts from the server's. Only a client may cache it: a deadline measured on
 * the server's clock would be dehydrated and then compared against the
 * browser's.
 */
export function recentAuthenticationQueryOptions() {
	return queryOptions({
		queryKey: accountQueryKeys.recentAuthentication(),
		queryFn: async (): Promise<RecentAuthentication> => {
			const remaining = await getRecentAuthenticationRemainingFn();
			return { freshUntil: Date.now() + remaining };
		},
	});
}
