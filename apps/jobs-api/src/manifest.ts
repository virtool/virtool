/**
 * Validation shared by the three finalize routes, run before anything reaches
 * storage or the database.
 *
 * A manifest entry names two things a workflow chose for itself: the filename
 * the row is registered under, and the storage key it wrote the bytes to. The
 * key is recorded verbatim, so this is where it is established that a runner's
 * key belongs to the resource it is finalizing.
 */

import { type StorageBackend, StorageKeyNotFoundError } from "@virtool/storage";

/** The two fields every manifest entry has, whatever resource it belongs to. */
export type ManifestEntry = {
	name: string;
	storageKey: string;
};

/**
 * Whether `key` is a fresh key under `prefix`.
 *
 * The prefix is `{domain}/{parentId}/` for the resource in the route's own path,
 * which is what `mintStorageKey` produces, so a key naming another resource —
 * another sample's reads, a cache blob Python's eviction walks — is refused
 * before the row that would point at it exists.
 *
 * The segment check covers a leading `/` as well: it would make the first
 * segment empty.
 */
export function isStorageKeyUnder(key: string, prefix: string): boolean {
	if (!key.startsWith(prefix) || key.length === prefix.length) {
		return false;
	}

	return key
		.split("/")
		.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * Whether `name` is a plain filename.
 *
 * Python addresses a subtraction file and a reads file by `name` in the URL of
 * its download endpoints, so a name carrying a separator or a traversal segment
 * is refused rather than left to be composed into a path later.
 */
export function isPlainFileName(name: string): boolean {
	return (
		name.length > 0 && !name.includes("/") && name !== ".." && name !== "."
	);
}

/**
 * Check a whole manifest, returning the message to refuse it with or `null`.
 *
 * `allowedNames` is the whitelist the resource accepts, or `null` where any
 * plain filename will do — analysis result files are the workflow's to name.
 *
 * Duplicates are rejected here rather than left to the unique constraints on
 * `storage_key` and `(parent, name)`, which would surface as a 500 on what is
 * plainly a malformed request.
 */
export function checkManifest(
	entries: readonly ManifestEntry[],
	prefix: string,
	allowedNames: readonly string[] | null,
): string | null {
	const names = new Set<string>();
	const keys = new Set<string>();

	for (const entry of entries) {
		if (!isPlainFileName(entry.name)) {
			return `Invalid file name: ${entry.name}`;
		}

		if (allowedNames && !allowedNames.includes(entry.name)) {
			return `Unsupported file name: ${entry.name}`;
		}

		if (!isStorageKeyUnder(entry.storageKey, prefix)) {
			return `Storage key is not under ${prefix}: ${entry.storageKey}`;
		}

		if (names.has(entry.name)) {
			return `Duplicate file name: ${entry.name}`;
		}

		if (keys.has(entry.storageKey)) {
			return `Duplicate storage key: ${entry.storageKey}`;
		}

		names.add(entry.name);
		keys.add(entry.storageKey);
	}

	return null;
}

/**
 * Pair every manifest entry with the size storage reports for its object, or
 * return `null` if one of them names nothing.
 *
 * This runs to completion **before** the finalize transaction opens, so a
 * manifest naming a blob that was never written writes no rows and leaves no
 * parent update behind. Keeping it outside also keeps a transaction from being
 * held open across a round trip to the bucket.
 *
 * The size a row is written with comes from here and nowhere else — a caller has
 * no say in it, which is what makes a row pointing at nothing impossible.
 */
export async function measureManifest<T extends ManifestEntry>(
	storage: StorageBackend,
	entries: readonly T[],
): Promise<(T & { size: number })[] | null> {
	try {
		return await Promise.all(
			entries.map(async (entry) => ({
				...entry,
				size: await storage.size(entry.storageKey),
			})),
		);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			return null;
		}

		throw err;
	}
}
