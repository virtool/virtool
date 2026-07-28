import { createQueryKeys } from "@app/queryKeys";

/**
 * Factory for generating react-query keys for index related queries.
 */
const indexKeys = createQueryKeys("indexes");

/**
 * Query keys for indexes.
 *
 * `unbuilt()` is the list of a reference's changes that no index covers yet. It
 * is keyed by reference rather than by index, so it gets its own namespace
 * instead of sharing the index details one.
 */
export const indexQueryKeys = {
	...indexKeys,
	unbuilt: (referenceId: number) =>
		[...indexKeys.all(), "unbuilt", referenceId] as const,
};
