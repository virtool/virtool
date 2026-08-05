import type { Cache, CacheRegistered } from "@virtool/contracts";
import { RegisterCacheRequest } from "@virtool/contracts";
import {
	CacheNotFoundError,
	CacheObjectMissingError,
	getCache,
	registerCache,
} from "@virtool/data/caches/data";
import type { Db } from "@virtool/data/db/pg";
import type { CacheRow } from "@virtool/data/db/schema/caches";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { requireJobRequest } from "../auth/guard";

/** What the cache handlers need to serve a request. */
export type CacheHandlerDeps = {
	db: Db;
	storage: StorageBackend;
	logger: Logger;
};

/**
 * Map a row to its wire shape.
 *
 * The mapping happens here, at the handler boundary, rather than inside
 * `@virtool/data` — `apps/web`'s client feature modules read the same data
 * functions, so renaming a field down there would break them at a distance.
 */
function toCache(row: CacheRow): Cache {
	return {
		id: row.id,
		key: row.key,
		storageKey: row.storage_key,
		size: row.size,
		params: row.params,
		createdAt: row.created_at.toISOString(),
		lastAccessedAt: row.last_accessed_at.toISOString(),
	};
}

/**
 * Resolve a logical cache key to the row that names the blob behind it.
 *
 * Metadata only. Workflows read object storage directly, so nothing here
 * streams cache bytes — the caller takes `storageKey` to the bucket itself.
 * This diverges from Python, which streamed the payload through its jobs API.
 */
export async function handleGetCache(
	deps: CacheHandlerDeps,
	request: Request,
	key: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	try {
		return Response.json(toCache(await getCache(deps.db, key)));
	} catch (err) {
		if (err instanceof CacheNotFoundError) {
			return Response.json({ message: "Cache not found" }, { status: 404 });
		}

		throw err;
	}
}

/**
 * Register a cache row for a blob the caller has already written.
 *
 * The body carries a uuid, never a storage key: the key is composed server-side
 * with `cacheKey(uuid)`, so a job-authenticated caller cannot point a cache row
 * at a sample, index or subtraction object — which Python's LRU eviction, which
 * deletes by `storage_key`, would then destroy.
 *
 * 201 when this call created the row, 200 when an equivalent one already
 * existed. Losing a race to another workflow deriving the same key is success,
 * not an error, and the response carries the winner's row either way.
 */
export async function handleRegisterCache(
	deps: CacheHandlerDeps,
	request: Request,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return Response.json({ message: "Malformed body" }, { status: 400 });
	}

	const parsed = RegisterCacheRequest.safeParse(body);

	if (!parsed.success) {
		return Response.json(
			{ message: "Invalid body", errors: parsed.error.issues },
			{ status: 400 },
		);
	}

	try {
		const { row, created } = await registerCache(
			deps.db,
			deps.storage,
			deps.logger,
			parsed.data,
		);

		const registered: CacheRegistered = { ...toCache(row), created };

		deps.logger.info(
			{ jobId: principal.jobId, key: row.key, created },
			"registered cache",
		);

		return Response.json(registered, { status: created ? 201 : 200 });
	} catch (err) {
		if (err instanceof CacheObjectMissingError) {
			return Response.json(
				{ message: "No object stored under that uuid" },
				{ status: 400 },
			);
		}

		throw err;
	}
}
