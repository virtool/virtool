/** A value that can be used as a filter segment in a query key. */
export type QueryKeyFilter =
	| string
	| number
	| boolean
	| undefined
	| readonly (string | number)[];

/** An identifier for a single cached record. */
export type QueryKeyId = string | number;

/** The complete set of query keys for one data domain. */
export type QueryKeys = {
	all: () => readonly [string];
	lists: () => readonly [string, "list"];
	list: (
		filters: readonly QueryKeyFilter[],
	) => readonly [string, "list", ...QueryKeyFilter[]];
	infiniteLists: () => readonly [string, "list", "infinite"];
	infiniteList: (
		filters: readonly QueryKeyFilter[],
	) => readonly [string, "list", "infinite", ...QueryKeyFilter[]];
	details: () => readonly [string, "details"];
	detail: (id: QueryKeyId) => readonly [string, "details", QueryKeyId];
};

/**
 * Build the query keys for a data domain.
 *
 * Every list variant extends `lists()` and every detail extends `details()`, so
 * invalidating the shorter key always invalidates the longer ones beneath it.
 * Features that cache something outside these seven shapes spread the result
 * and derive the extra member from a base key, keeping it inside the hierarchy.
 * Give custom variants their own segment; an empty filter list aliases the
 * invalidation prefix instead of distinguishing a cache entry.
 *
 * @param domain - The namespace the keys are rooted at, usually the plural resource name
 * @returns The query keys for the domain
 */
export function createQueryKeys(domain: string): QueryKeys {
	const all = () => [domain] as const;
	const lists = () => [domain, "list"] as const;
	const infiniteLists = () => [domain, "list", "infinite"] as const;
	const details = () => [domain, "details"] as const;

	return {
		all,
		lists,
		list: (filters) => [...lists(), ...filters] as const,
		infiniteLists,
		infiniteList: (filters) => [...infiniteLists(), ...filters] as const,
		details,
		detail: (id) => [...details(), id] as const,
	};
}
