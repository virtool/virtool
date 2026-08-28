import { passwordPolicyQueryKeys } from "@administration/keys";
import { getPasswordPolicyFn } from "@server/settings/functions";
import { queryOptions } from "@tanstack/react-query";

/**
 * Query options for the instance password policy.
 *
 * Unlike the rest of `queries.ts`, this is readable without a session — the
 * first-user and forced-reset forms need it before one exists. It lives apart
 * from `queries.ts` so the unauthenticated `/login` and `/setup` loaders can
 * reach it without pulling in that module's whole request layer — its other
 * server-function stubs, and the zod schemas they carry.
 */
export function passwordPolicyQueryOptions() {
	return queryOptions({
		queryKey: passwordPolicyQueryKeys.all(),
		queryFn: () => getPasswordPolicyFn(),
		// Password policy changes emit no SSE event, so this query needs the
		// focus refetch that the global defaults otherwise skip.
		refetchOnWindowFocus: true,
	});
}
