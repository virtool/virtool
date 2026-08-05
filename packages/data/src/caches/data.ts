import type { JsonObject } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { cacheKey, StorageKeyNotFoundError } from "@virtool/storage";
import { eq } from "drizzle-orm";
import type { Db } from "../db/pg";
import { type CacheRow, caches } from "../db/schema/caches";
import { AppError } from "../errors";

/**
 * How stale `last_accessed_at` must be before a lookup refreshes it.
 *
 * Python's `LAST_ACCESSED_REFRESH_INTERVAL` (`virtool/caches/data.py`), and the
 * threshold has to stay the same on both sides because both services read the
 * same rows. Refreshing unconditionally would turn every cache lookup — which
 * is on the hot path of every workflow start — into a write.
 */
const LAST_ACCESSED_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Thrown when no cache row matches the requested key. */
export class CacheNotFoundError extends AppError {}

/** Thrown when a registration names a uuid with no object behind it. */
export class CacheObjectMissingError extends AppError {}

/** Fields needed to register a cache whose blob the caller has already written. */
export type CacheRegisterValues = {
	key: string;

	/**
	 * The uuid the writer minted for its own blob, already validated as 32 hex
	 * characters at the boundary. The storage key is composed from it here and
	 * never accepted from a caller.
	 */
	uuid: string;

	params: JsonObject;
};

/** A registered cache row, and whether this call is what created it. */
export type CacheRegistration = {
	row: CacheRow;
	created: boolean;
};

async function findCacheByKey(db: Db, key: string): Promise<CacheRow | null> {
	const [row] = await db
		.select()
		.from(caches)
		.where(eq(caches.key, key))
		.limit(1);

	return row ?? null;
}

/**
 * Resolve a logical cache key to its row, refreshing `last_accessed_at` only
 * when it has gone stale.
 *
 * The row's `storage_key` is the point of this call: it is a per-write uuid, so
 * a workflow holding a derived cache key cannot reach the blob without asking.
 */
export async function getCache(db: Db, key: string): Promise<CacheRow> {
	const row = await findCacheByKey(db, key);

	if (row === null) {
		throw new CacheNotFoundError();
	}

	const now = new Date();

	if (
		now.getTime() - row.last_accessed_at.getTime() <
		LAST_ACCESSED_REFRESH_INTERVAL_MS
	) {
		return row;
	}

	await db
		.update(caches)
		.set({ last_accessed_at: now })
		.where(eq(caches.id, row.id));

	return { ...row, last_accessed_at: now };
}

/**
 * Register a cache row for a blob the caller has already written to
 * `caches/v1/<uuid>`.
 *
 * Storage is read **before** any database work, and the size stored is the one
 * this side measured — a caller that declares a blob it did not write gets a
 * `CacheObjectMissingError` and leaves no row behind, and a caller that lies
 * about the size is simply ignored.
 *
 * Two workflows can legitimately derive the same cache key at once, and both
 * blobs hold the same bytes, so **losing that race is success**. The insert
 * targets the `cache_key` constraint specifically: a `storage_key` collision can
 * only mean a reused uuid, which is a bug, and must still raise rather than be
 * swallowed. This deliberately diverges from Python, which raises
 * `CacheAlreadyExistsError` on the same race.
 *
 * The loser then deletes its own orphan — but **only once it has established
 * the winner is somebody else**. A retry of a call that already succeeded
 * arrives with the same uuid and so re-selects its own row, and deleting there
 * would leave a live row pointing at nothing. Otherwise the delete is safe,
 * because `storage_key` is a per-write uuid and the winner's row points
 * elsewhere, and it is necessary, because an orphan has no row and Python's LRU
 * eviction walks rows. It happens after the write has committed, so a storage
 * failure only leaks bytes and is logged rather than thrown.
 */
export async function registerCache(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	values: CacheRegisterValues,
): Promise<CacheRegistration> {
	const storageKey = cacheKey(values.uuid);

	let size: number;

	try {
		size = await storage.size(storageKey);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			throw new CacheObjectMissingError();
		}

		throw err;
	}

	const now = new Date();

	// A single statement, so it needs no transaction of its own: it either
	// inserts or takes no row, and a concurrent inserter blocks it only until
	// that inserter commits.
	const [inserted] = await db
		.insert(caches)
		.values({
			key: values.key,
			storage_key: storageKey,
			params: values.params,
			size,
			created_at: now,
			last_accessed_at: now,
		})
		.onConflictDoNothing({ target: caches.key })
		.returning();

	if (inserted) {
		return { row: inserted, created: true };
	}

	const winner = await findCacheByKey(db, values.key);

	if (winner === null) {
		// The conflicting row was deleted between the insert and this read —
		// eviction is the only thing that does that. Genuinely unexpected, and not
		// something the caller can act on, so it is not an AppError.
		throw new Error(`cache row for ${values.key} vanished mid-registration`);
	}

	// Same uuid means this is a retry of a call that already inserted, so the
	// object is the one the winning row names. Deleting it would strand a live
	// row on nothing, which no later lookup could detect and no eviction fix.
	if (winner.storage_key !== storageKey) {
		try {
			await storage.delete(storageKey);
		} catch (err) {
			logger.warn(
				{ err, key: values.key, storageKey },
				"cache orphan cleanup failed; object orphaned",
			);
		}
	}

	return { row: winner, created: false };
}
