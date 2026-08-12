import type { JsonObject } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { cacheKey, StorageKeyNotFoundError } from "@virtool/storage";
import { asc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "../db/pg";
import { type CacheRow, caches } from "../db/schema/caches";
import { secondsAgo } from "../db/time";
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

/**
 * How much object storage the cache store is allowed to occupy.
 *
 * Python's `CACHE_STORAGE_BUDGET` (`virtool/config/cls.py`), where it is the
 * default of a `--cache-storage-budget` option no deployment overrides. It is a
 * bare constant here rather than a `VT_` key because it is application state —
 * how much of the bucket caching may spend — not something about the pod it
 * runs in, and a per-replica environment variable is the wrong shape for a
 * fleet-wide budget. Making it configurable follows under VIR-2925.
 */
export const CACHE_STORAGE_BUDGET_BYTES = 100 * 1024 ** 3;

/**
 * How old a cache must be before budget pressure can evict it.
 *
 * Python's `CACHE_EVICTION_GRACE_PERIOD`. A cache is written by one workflow
 * and read by the next, and the two can be an hour apart, so a fresh entry is
 * off limits however little it has been used.
 */
const CACHE_EVICTION_GRACE_PERIOD_SECONDS = 60 * 60;

/**
 * How many cache objects eviction deletes at once.
 *
 * Python's `CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY`. Deletes are one round
 * trip each and a run can have hundreds to make, so they overlap — but not
 * without bound, which would open a connection per candidate against a bucket
 * this process shares with every workflow pod.
 */
const CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY = 8;

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

/** A cache row eviction has chosen, and everything needed to remove it. */
type EvictionCandidate = {
	id: number;
	key: string;
	storageKey: string;
	size: number;
	lastAccessedAt: Date;
};

/**
 * The least-recently-used rows whose removal would bring the store under
 * `budgetBytes`, oldest first.
 *
 * One statement, where Python takes two — a `SELECT sum(size)` and then the
 * candidate query. Folding the total into a CTE-free scalar subquery removes
 * the window between them, in which a concurrent write could change the figure
 * the second statement is selecting against.
 *
 * The running total is a window function over the *filtered* rows, and a row
 * qualifies while the bytes ahead of it — `cumulative_size - size` — fall short
 * of what has to be freed. That is what admits the last candidate, the one that
 * carries the total past the target: dropping it would leave the store over
 * budget by however much of it is needed. Python's `bytes_to_free <= 0` early
 * return needs no equivalent, because the preceding bytes are never negative and
 * so no row can satisfy the comparison against a non-positive target.
 *
 * **The grace period filters the candidates but not the total**, which is
 * Python's behaviour and is inherited deliberately: the two runners have to
 * evict the same rows until the cutover completes. A store that is over budget
 * on entries younger than the grace period therefore frees less than it needs,
 * or nothing at all, and waits for them to age. Widening the total to the
 * filtered set instead would understate the overage and evict too little; the
 * fix is a shorter grace period, not a different sum.
 */
async function selectEvictionCandidates(
	db: Db,
	budgetBytes: number,
): Promise<EvictionCandidate[]> {
	const candidates = db
		.select({
			id: caches.id,
			key: caches.key,
			storageKey: caches.storage_key,
			size: caches.size,
			lastAccessedAt: caches.last_accessed_at,
			cumulativeSize:
				sql`sum(${caches.size}) over (order by ${caches.last_accessed_at} asc, ${caches.id} asc)`.as(
					"cumulative_size",
				),
		})
		.from(caches)
		.where(
			lt(
				caches.last_accessed_at,
				secondsAgo(CACHE_EVICTION_GRACE_PERIOD_SECONDS),
			),
		)
		.as("candidates");

	return db
		.select({
			id: candidates.id,
			key: candidates.key,
			storageKey: candidates.storageKey,
			size: candidates.size,
			lastAccessedAt: candidates.lastAccessedAt,
		})
		.from(candidates)
		.where(
			sql`${candidates.cumulativeSize} - ${candidates.size} < (select coalesce(sum(${caches.size}), 0) - ${budgetBytes} from ${caches})`,
		)
		.orderBy(asc(candidates.lastAccessedAt), asc(candidates.id));
}

/**
 * Delete every candidate's object, at most
 * {@link CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY} at a time.
 *
 * Every delete is attempted before the first failure is raised, matching
 * Python's `gather(..., return_exceptions=True)` followed by a re-raise: a
 * bucket refusing one key says nothing about the rest, and stopping on it would
 * leave objects behind that this run has already decided to reclaim.
 *
 * The exact `storage_key` recorded on the row is deleted, never a prefix — the
 * key is a per-write uuid and a prefix delete would reach another row's object.
 * `delete` is idempotent, so an object a previous, interrupted run already
 * removed costs a round trip and nothing else.
 *
 * `signal` is checked between deletes rather than forwarded, the backend taking
 * none. An abort therefore leaves rows whose objects are gone — which is
 * exactly the state a crash mid-run leaves, and the state storage-first
 * ordering already accepts, because the alternative is objects no row names and
 * no eviction can ever reach. The next run selects those same rows, being still
 * the least recently used, and finishes the job.
 *
 * An aborting worker **stops rather than throws**, and the abort is raised only
 * once every worker has settled. Throwing from inside one rejects the `Promise.all`
 * on the spot and abandons the deletes its siblings still have in flight, which
 * then run on past the run that reported the abort — the drain would report a
 * quiesced task with work still moving behind it. Stopping bounds the tail at one
 * in-flight delete per worker.
 */
async function deleteCandidateObjects(
	storage: StorageBackend,
	candidates: EvictionCandidate[],
	signal?: AbortSignal,
): Promise<void> {
	const failures: { index: number; err: unknown }[] = [];

	let next = 0;

	async function worker(): Promise<void> {
		for (let index = next++; index < candidates.length; index = next++) {
			if (signal?.aborted) {
				return;
			}

			const candidate = candidates[index];

			if (candidate === undefined) {
				continue;
			}

			try {
				await storage.delete(candidate.storageKey);
			} catch (err) {
				failures.push({ index, err });
			}
		}
	}

	await Promise.all(
		Array.from(
			{
				length: Math.min(
					CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY,
					candidates.length,
				),
			},
			worker,
		),
	);

	// Every worker has settled by here, so nothing is still deleting behind the
	// abort this raises.
	signal?.throwIfAborted();

	// The earliest candidate's failure, matching the order `gather` raises in.
	const [first] = failures.sort((a, b) => a.index - b.index);

	if (first !== undefined) {
		throw first.err;
	}
}

/**
 * Evict least-recently-used caches until the store is back under `budgetBytes`.
 *
 * The port of Python's `CachesData.evict_lru`, and idempotent by construction:
 * a re-run selects whatever is still over budget, and every delete it makes is
 * idempotent on its own, so a reclaimed task repeating this from step zero
 * leaves what one pass leaves.
 *
 * **Objects go before rows.** A failure part-way through leaves rows naming
 * objects that are gone, which a later run reclaims and a reader can at least
 * detect; the other order leaks objects no row names, which nothing here would
 * ever find again. Nothing is deleted from the table until every object is
 * gone, so a bucket that is refusing deletes costs a run rather than a table
 * full of dangling rows.
 *
 * Only the ids the `DELETE` returns are logged. A row another writer removed
 * between the select and the delete is not this run's to report.
 */
export async function evictLruCaches(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	budgetBytes: number,
	signal?: AbortSignal,
): Promise<void> {
	const candidates = await selectEvictionCandidates(db, budgetBytes);

	if (candidates.length === 0) {
		return;
	}

	await deleteCandidateObjects(storage, candidates, signal);

	const ids = candidates.map((candidate) => candidate.id);

	// `= any($1)` over one array parameter rather than an `in` list, which binds
	// a parameter per id and would put a run with tens of thousands of candidates
	// against Postgres's parameter ceiling. `sql.param` is what keeps the array
	// whole — an array interpolated directly is spread into a comma-separated
	// list of parameters, which is the thing being avoided.
	const deleted = await db
		.delete(caches)
		.where(sql`${caches.id} = any(${sql.param(ids)}::int[])`)
		.returning({ id: caches.id });

	const deletedIds = new Set(deleted.map((row) => row.id));

	for (const candidate of candidates) {
		if (!deletedIds.has(candidate.id)) {
			continue;
		}

		logger.info(
			{
				key: candidate.key,
				lastAccessedAt: candidate.lastAccessedAt,
				size: candidate.size,
			},
			"evicted cache entry",
		);
	}
}
