// The cache endpoints' wire contract, shared by the handlers in `apps/jobs-api`
// and the workflow runtime that calls them.
//
//   GET  /caches/{key}  -                    -> Cache           (200 | 404)
//   POST /caches        RegisterCacheRequest -> CacheRegistered (201 created | 200 existed)
//
// Workflows reuse expensive derived artifacts — trimmed reads, mapping indexes,
// collapsed references — by deriving a logical cache key and asking for it.
// **Lookup is what makes the cache usable at all**: a row's `storageKey` is a
// per-write UUID and cannot be recomputed from the cache key, so a workflow
// cannot read a cached blob until this server has resolved one to the other.
//
// **No endpoint carries cache bytes.** Workflows have direct object-storage
// access: the writer puts the blob at `caches/v1/<uuid>` itself and then
// registers the row, and the reader takes `storageKey` to the bucket. This
// diverges from Python, which streamed payloads through its jobs API.

import { z } from "zod";
import { JsonObject } from "./json";

/**
 * The UUID a writer minted for its own blob, as `uuid4().hex` — 32 lowercase
 * hex characters, matching what Python writes.
 *
 * The wire carries this rather than a storage key, and the server composes the
 * key with `cacheKey(uuid)`. A caller-supplied key would let a job-authenticated
 * caller register a cache row pointing at a sample, index or subtraction
 * object — and Python's LRU eviction deletes by `storage_key`, so that is a
 * route to having another domain's files destroyed. Validating a uuid and
 * composing the key server-side makes that unrepresentable.
 */
export const CacheUuid = z.string().regex(/^[0-9a-f]{32}$/);

/** Body for `POST /caches` — what a workflow declares after writing its blob. */
export const RegisterCacheRequest = z.object({
	key: z.string().min(1),
	uuid: CacheUuid,

	/** Diagnostic metadata persisted with the row. Not used for lookup. */
	params: JsonObject,
});

export type RegisterCacheRequest = z.infer<typeof RegisterCacheRequest>;

/**
 * A cache row as the endpoints return it.
 *
 * camelCase, like everything else on this wire; the Drizzle mirror keeps
 * Python's snake_case column names because those are row content. `size` is the
 * size the server read from storage, never one the caller sent.
 */
export const Cache = z.object({
	id: z.number().int(),
	key: z.string(),
	storageKey: z.string(),
	size: z.number().int().nonnegative(),
	params: JsonObject,
	createdAt: z.string(),
	lastAccessedAt: z.string(),
});

export type Cache = z.infer<typeof Cache>;

/**
 * Response to `POST /caches`.
 *
 * Two workflows can legitimately derive the same cache key at once, and both
 * blobs hold the same bytes, so **"already existed" is success**. The loser
 * receives the winner's row — its `id`, `storageKey` and `size` — so it reads
 * the blob that actually survived. `created` distinguishes the two only for
 * logging.
 */
export const CacheRegistered = Cache.extend({
	created: z.boolean(),
});

export type CacheRegistered = z.infer<typeof CacheRegistered>;
