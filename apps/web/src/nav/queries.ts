import { getRootFn } from "@server/root/functions";
import { queryOptions } from "@tanstack/react-query";
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
