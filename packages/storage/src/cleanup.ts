import type { StorageBackend } from "./types";

/** A key that could not be deleted, paired with the error that stopped it. */
export type DeleteFailure = {
	key: string;
	error: unknown;
};

/**
 * Best-effort delete of every object under `prefix`.
 *
 * Never throws. Callers reach this having already committed the database write
 * that orphaned these objects, so propagating one failure would abandon the
 * rest of the cleanup while telling the client the whole operation failed.
 * Failures come back instead, and callers are expected to log them so the
 * orphans stay observable.
 *
 * If the listing itself fails, no per-object keys are known, so the prefix is
 * reported in place of a key.
 */
export async function deletePrefix(
	storage: StorageBackend,
	prefix: string,
): Promise<DeleteFailure[]> {
	const keys: string[] = [];

	try {
		for await (const object of storage.list(prefix)) {
			keys.push(object.key);
		}
	} catch (error) {
		return [{ key: prefix, error }];
	}

	const results = await Promise.all(
		keys.map(async (key) => {
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
