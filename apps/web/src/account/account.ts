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
 * page load pays for — so it must not reach `@app/api`, and `queries.ts` does,
 * for the API-key and password hooks. Tree-shaking cannot save us here: the
 * chunk is the unit of loading, so importing `queries.ts` for one server-function
 * -backed export still drags superagent in.
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
