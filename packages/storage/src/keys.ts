/**
 * Storage keys, which must stay byte-for-byte identical to the ones Python
 * builds. Both processes read and write the same bucket, so a divergence here
 * does not fail loudly — it silently reads nothing and orphans what it writes.
 */

/** Key for an uploaded file. */
export function uploadFileKey(nameOnDisk: string): string {
	return `files/${nameOnDisk}`;
}

/** Key for an analysis file. */
export function analysisFileKey(nameOnDisk: string): string {
	return `analyses/${nameOnDisk}`;
}

/**
 * The prefix segment a sample's files live under, fixed for the sample's life.
 * Mongo-migrated samples keep their legacy id; Postgres-native ones use the
 * integer primary key.
 */
export function sampleStorageId(
	sampleId: number,
	legacyId: string | null,
): string {
	return legacyId || String(sampleId);
}

/** Key for a sample file. */
export function sampleFileKey(storageId: string, filename: string): string {
	return `samples/${storageId}/${filename}`;
}

/** Prefix holding every file for a sample. */
export function samplePrefix(storageId: string): string {
	return `samples/${storageId}/`;
}

/**
 * Prefix holding the stored result objects of a Mongo-migrated analysis, nested
 * under its parent sample. Only analyses migrated from Mongo have one:
 * Postgres-native analyses keep their results in the `results` column and write
 * nothing to storage.
 */
export function analysisPrefix(
	sampleStorageId: string,
	analysisLegacyId: string,
): string {
	return `samples/${sampleStorageId}/analysis/${analysisLegacyId}/`;
}

// Subtraction ids may contain spaces. Python substitutes underscores when
// composing the key, so the same subtraction resolves to the same key here.
function normalizeSubtractionId(subtractionId: string): string {
	return subtractionId.replaceAll(" ", "_");
}

/**
 * The prefix segment a subtraction's files live under, fixed for its life.
 * Mongo-migrated subtractions keep their legacy id; Postgres-native ones use
 * the integer primary key.
 */
export function subtractionStorageId(
	subtractionId: number,
	legacyId: string | null,
): string {
	return legacyId || String(subtractionId);
}

/** Key for a subtraction file. */
export function subtractionFileKey(
	subtractionId: string,
	filename: string,
): string {
	return `subtractions/${normalizeSubtractionId(subtractionId)}/${filename}`;
}

/** Prefix holding every file for a subtraction. */
export function subtractionPrefix(subtractionId: string): string {
	return `subtractions/${normalizeSubtractionId(subtractionId)}/`;
}

/**
 * Key for an index file.
 *
 * The segment is the index's `storage_key` column, not its row id — a migrated
 * index keys on its old Mongo id and a natively-created one on a minted UUID,
 * so neither can be derived from the id.
 */
export function indexFileKey(storageKey: string, filename: string): string {
	return `indexes/${storageKey}/${filename}`;
}

/** Prefix holding every file for an index. */
export function indexPrefix(storageKey: string): string {
	return `indexes/${storageKey}/`;
}

/** Key for a cache. Persisted on the cache row rather than recomputed. */
export function cacheKey(uuid: string): string {
	return `caches/v1/${uuid}`;
}

/** Key for the HMM profiles blob. */
export const HMM_PROFILES_KEY = "hmm/profiles.hmm";

/** Key for the HMM annotations blob. */
export const HMM_ANNOTATIONS_KEY = "hmm/annotations.json.gz";
