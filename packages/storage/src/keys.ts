/**
 * Minting of object-storage keys, which must stay byte-for-byte compatible with
 * the ones Python mints. Both processes read and write the same bucket, so a
 * divergence here does not fail loudly — it silently reads nothing and orphans
 * what it writes.
 *
 * Keys are not derived from database identity. Every row that names a stored
 * object records its complete key verbatim, so no read path recomposes one and
 * no change to how keys are chosen can force objects to move. Objects written
 * before keys were recorded keep whatever prefix they were stored under, so the
 * keys in the bucket are heterogeneous by design.
 */

import { randomUUID } from "node:crypto";

// Python mints the leaf with `uuid4().hex`, which carries no hyphens.
function uuidHex(): string {
	return randomUUID().replaceAll("-", "");
}

/**
 * Mint a fresh key for a file belonging to `parentId`.
 *
 * The `parentId` segment groups an owning resource's objects for human
 * inspection and has no meaning to any read path — the row records the whole
 * key.
 */
export function mintStorageKey(domain: string, parentId: number): string {
	return `${domain}/${parentId}/${uuidHex()}`;
}

/**
 * Mint a fresh key for a resource that has no owner.
 *
 * Uploads are not files belonging to some other resource — they are the
 * resource — so there is no parent id to group them under.
 *
 * Minting without a parent id also means the key is available before the row
 * exists, so the object can be written first and the row created afterwards.
 * That keeps a database transaction from being held open for the length of the
 * upload stream.
 */
export function mintRootStorageKey(domain: string): string {
	return `${domain}/${uuidHex()}`;
}

/** Key for a cache. Persisted on the cache row rather than recomposed. */
export function cacheKey(uuid: string): string {
	return `caches/v1/${uuid}`;
}

/** Key for the HMM profiles blob. */
export const HMM_PROFILES_KEY = "hmm/profiles.hmm";

/** Key for the HMM annotations blob. */
export const HMM_ANNOTATIONS_KEY = "hmm/annotations.json.gz";
