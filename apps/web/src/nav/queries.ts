import { getRootFn } from "@server/root/functions";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { rootQueryKeys } from "@wall/keys";

/**
 * Query options for the instance root document.
 *
 * The `_authenticated` guard reads it before any session exists to decide
 * first-user setup, so it is in the eager bundle every page load pays for. The
 * module imports one server function and nothing else, keeping the rest of the
 * request layer off the login wall.
 */
export function rootQueryOptions() {
	return queryOptions({
		queryKey: rootQueryKeys.all(),
		queryFn: () => getRootFn(),
	});
}

/**
 * Initializes a query for fetching the root document.
 *
 * Lives here rather than in `@wall/queries` because the wall never reads the
 * root document — the About dialog does. `LoginWall` imports `@wall/queries`
 * for its login and reset mutations, so keeping the root query out of that
 * module avoids loading it on the unauthenticated `/login` first paint.
 *
 * @returns A query for fetching the root document
 */
export function useRootQuery() {
	return useQuery(rootQueryOptions());
}
