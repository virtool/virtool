import { accountQueryKeys } from "@account/keys";
import type { Account } from "@account/types";
import { getAccountFn } from "@server/users/functions";
import { queryOptions, useQuery } from "@tanstack/react-query";

/**
 * Reading the signed-in user's own account.
 *
 * Apart from `queries.ts` because the route guards on `/login`, `/_authenticated`
 * and `/administration` all resolve an account in `beforeLoad`, and `beforeLoad`
 * is a critical route export. Anything it reaches is in the eager bundle every
 * page load pays for — so it must not reach `@app/api`. `queries.ts` no longer
 * does, but the split stays: tree-shaking cannot save us here, because the chunk
 * is the unit of loading, so one `apiClient` call added to `queries.ts` later
 * would drag superagent onto the login wall with nothing to catch it.
 *
 * The account is served by a server function, so this module needs no HTTP
 * client at all. An anonymous call rejects with `UnauthorizedError` — that
 * rejection is how the guards learn nobody is signed in.
 */
export function accountQueryOptions() {
	return queryOptions<Account>({
		queryKey: accountQueryKeys.all(),
		queryFn: () => getAccountFn(),
	});
}

/**
 * Fetches account data for the logged-in user
 *
 * @returns UseQueryResult object containing the account data
 */
export function useFetchAccount() {
	return useQuery(accountQueryOptions());
}
