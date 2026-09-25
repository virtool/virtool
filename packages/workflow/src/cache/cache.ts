/**
 * The workflow-side cache.
 *
 * A workflow reuses expensive derived artifacts — mapping indexes, a collapsed
 * reference — by deriving a logical key from the inputs that produced them and
 * asking for it. The blob is an **uncompressed tar of one directory**, whose
 * single top-level entry is the directory's own basename, exactly as
 * `writePathAsTar` produces and `extractTarToDir` expects. That layout is not
 * an implementation detail: blobs already in the bucket are laid out this way,
 * and every later run of a workflow restores what earlier runs archived.
 *
 * ## No endpoint carries bytes
 *
 * No jobs API endpoint streams cache payloads. The jobs API resolves a logical
 * key to a row and the workflow moves the bytes itself:
 *
 * - a **read** is `GET /caches/{key}` for the row's `storageKey`, then a
 *   streamed download;
 * - a **write** is a minted uuid, a streamed upload to `cacheKey(uuid)`, then
 *   `POST /caches` to register the row.
 *
 * The write order matters. Registering before the bytes land would publish a row
 * pointing at nothing, and the next reader would fail rather than miss.
 */

import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { extractTarToDir, writePathAsTar } from "@virtool/archive/tar";
import { Cache, CacheRegistered } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { cacheKey, StorageKeyNotFoundError } from "@virtool/storage";
import type { JobsApiClient } from "../client/client";
import { NotFoundError } from "../client/errors";
import type { BuildContextInput } from "../context";
import { WorkflowError } from "../errors";
import { downloadToPath, uploadFromPath } from "../files/transfer";
import { type CacheParams, deriveCacheKey, toJsonCacheParams } from "./key";

/** The workflow cache, over one run's jobs API client and storage backend. */
export type WorkflowCache = {
	/**
	 * Restore the blob at `key` into `directory`.
	 *
	 * @returns the path of the restored top-level entry, or `null` on a miss.
	 */
	get: (key: string, directory: string) => Promise<string | null>;

	/**
	 * Archive `directory` and register it under `key`.
	 *
	 * @returns whether this call created the row. An existing key is **success**:
	 *   two runs can derive the same key at once and both blobs hold the same
	 *   bytes, so the loser is handed the winner's row.
	 */
	put: (
		key: string,
		directory: string,
		params: CacheParams,
	) => Promise<boolean>;
};

/** What {@link createWorkflowCache} needs. */
export type CreateWorkflowCacheOptions = {
	client: JobsApiClient;
	storage: StorageBackend;
	/**
	 * Where archives are staged. Defaults to the OS temp directory.
	 *
	 * A caller passing the run's work path keeps a multi-gigabyte index archive
	 * on the same volume as everything else it writes, which is the only volume
	 * a pod is sized for.
	 */
	stagingPath?: string;
};

/**
 * A uuid with its dashes stripped — 32 lowercase hex characters, which is what
 * `CacheUuid` accepts and how uuids already in the bucket are spelled.
 */
function mintCacheUuid(): string {
	return randomUUID().replaceAll("-", "");
}

export function createWorkflowCache({
	client,
	storage,
	stagingPath,
}: CreateWorkflowCacheOptions): WorkflowCache {
	async function withStaging<T>(use: (path: string) => Promise<T>): Promise<T> {
		if (stagingPath !== undefined) {
			await mkdir(stagingPath, { recursive: true });
		}

		const staging = await mkdtemp(
			join(stagingPath ?? tmpdir(), "workflow-cache-"),
		);

		try {
			return await use(staging);
		} finally {
			// The archive is a second copy of an artifact that can run to
			// gigabytes, and a one-shot pod's disk is sized for one.
			await rm(staging, { force: true, recursive: true });
		}
	}

	return {
		async get(key, directory) {
			let cache: Cache;

			try {
				cache = await client.request({
					method: "GET",
					// The logical key can carry a slash, so it is encoded as one
					// segment rather than pasted in raw.
					path: `/caches/${encodeURIComponent(key)}`,
					schema: Cache,
				});
			} catch (err) {
				// A miss is the ordinary outcome and is not an error. Anything else
				// — a 500, a refused key — is, and must not be reported as a miss:
				// that would silently rebuild the artifact every run.
				if (err instanceof NotFoundError) {
					return null;
				}

				throw err;
			}

			return withStaging(async (staging) => {
				const archivePath = join(staging, "cache.tar");

				try {
					await downloadToPath(storage, cache.storageKey, archivePath);
				} catch (err) {
					if (err instanceof StorageKeyNotFoundError) {
						return null;
					}

					throw err;
				}

				return extractTarToDir(archivePath, directory);
			});
		},

		put(key, directory, params) {
			return withStaging(async (staging) => {
				const archivePath = join(staging, "cache.tar");

				await writePathAsTar(directory, archivePath);

				const uuid = mintCacheUuid();

				// The bytes land first. A row registered ahead of its blob points at
				// nothing, and the next reader fails where it should have missed.
				await uploadFromPath(storage, cacheKey(uuid), archivePath);

				const registered = await client.request({
					method: "POST",
					path: "/caches",
					body: { key, uuid, params: toJsonCacheParams(params) },
					schema: CacheRegistered,
				});

				return registered.created;
			});
		},
	};
}

/**
 * The run's cache, built from the handles already on its context.
 *
 * Archives are staged under the work path, not the OS temp directory — a mapping
 * index runs to gigabytes and the work path is the only volume a pod is sized
 * for.
 */
export function cacheFor(
	context: Pick<BuildContextInput, "client" | "storage" | "workPath">,
): WorkflowCache {
	return createWorkflowCache({
		client: context.client,
		storage: context.storage,
		stagingPath: join(context.workPath, "caches"),
	});
}

/** What {@link restoreOrBuild} needs. */
export type RestoreOrBuildOptions = {
	cache: WorkflowCache;
	/** The artifact's namespace, for logs and errors. */
	kind: string;
	params: CacheParams;
	/** The artifact's directory, which the blob archives whole. */
	directory: string;
	logger: Logger;
	/** Write the artifact into `directory`, called only once the cache has missed. */
	build: () => Promise<void>;
};

/**
 * Restore an artifact directory from the cache, or build it and cache it.
 *
 * The blob is restored into the directory's parent, so its one top-level entry
 * recreates the directory itself.
 */
export async function restoreOrBuild({
	build,
	cache,
	directory,
	kind,
	logger,
	params,
}: RestoreOrBuildOptions): Promise<void> {
	const key = deriveCacheKey(params);
	const log = logger.child({ cacheKind: kind, key });

	const restored = await cache.get(key, dirname(directory));

	if (restored !== null) {
		// A blob's one top-level entry is named after the directory its writer
		// archived, so a blob archived from a differently named directory unpacks
		// *beside* the artifact rather than onto it. Thrown rather than treated as
		// a miss: `cache.put` cannot replace a registered key, so rebuilding would
		// hand the same blob back to every later run while leaving the stray tree
		// on a disk sized for one copy of the artifact.
		if (restored !== directory) {
			throw new WorkflowError(
				`Cached ${kind} restored to ${restored}, not ${directory}`,
			);
		}

		log.info("restored cached artifact");

		return;
	}

	log.info("building uncached artifact");

	await build();

	// An already-registered key is success, not an error: another run can have
	// derived the same key and built the same artifact while this one was
	// working.
	const created = await cache.put(key, directory, params);

	log.info({ created }, "cached artifact");
}
