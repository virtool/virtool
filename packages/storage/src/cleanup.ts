import type { StorageBackend } from "./types";

/** A key that could not be deleted, paired with the error that stopped it. */
export type DeleteFailure = {
	key: string;
	error: unknown;
};

/**
 * Best-effort delete of every object named by `keys`.
 *
 * Never throws. Callers reach this having already committed the database write
 * that orphaned these objects, so propagating one failure would abandon the
 * rest of the cleanup while telling the client the whole operation failed.
 * Failures come back instead, and callers are expected to log them so the
 * orphans stay observable.
 *
 * Callers pass the keys recorded on the rows they are deleting, which must be
 * read before those rows go, so only objects a row names are removed. Objects
 * written before keys were recorded are unreachable this way and are left for a
 * separate sweep.
 */
export async function deleteKeys(
	storage: StorageBackend,
	keys: Iterable<string>,
): Promise<DeleteFailure[]> {
	const results = await Promise.all(
		[...keys].map(async (key) => {
			try {
				await storage.delete(key);
				return null;
			} catch (error) {
				return { key, error };
			}
		}),
	);

	return results.filter((failure) => failure !== null);
}
