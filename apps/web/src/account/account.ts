import { accountQueryKeys } from "@account/keys";
import { getAccountFn } from "@server/users/functions";
import {
	queryOptions,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Account } from "@virtool/contracts";

/**
 * Reading the signed-in user's own account.
 *
 * Apart from `queries.ts` because the route guards on `/login`, `/_authenticated`
 * and `/administration` all resolve an account in `beforeLoad`, and `beforeLoad`
 * is a critical route export. Anything it reaches is in the eager bundle every
 * page load pays for. Tree-shaking cannot save us here — the chunk is the unit
 * of loading, so importing `queries.ts` for this one export would put every
 * other account request, and the zod schemas they carry, on the login wall.
 *
 * An anonymous call rejects with `UnauthorizedError` — that rejection is how
 * the guards learn nobody is signed in.
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

/**
 * Fetches account data for the logged-in user, suspending until it resolves.
 *
 * `data` is always defined. Use this where the account is the view's primary
 * data, so that loading is handled by the enclosing `Suspense` rather than an
 * inline placeholder of its own.
 *
 * @returns UseSuspenseQueryResult object containing the account data
 */
export function useSuspenseAccount() {
	return useSuspenseQuery(accountQueryOptions());
}
