/**
 * The workflow-side cache, ported from Python's `WorkflowCache`.
 *
 * A workflow reuses expensive derived artifacts — mapping indexes, a collapsed
 * reference — by deriving a logical key from the inputs that produced them and
 * asking for it. The blob is an **uncompressed tar of one directory**, whose
 * single top-level entry is the directory's own basename, exactly as
 * `write_path_as_tar` produces and `extract_tar_to_dir` expects. That layout is
 * not an implementation detail: the `reference_mapping_index` and
 * `subtraction_mapping_index` namespaces are shared with Python, so a blob
 * written here is restored there and the reverse.
 *
 * ## No endpoint carries bytes
 *
 * This diverges from Python, which streamed cache payloads through its jobs API.
 * Here the jobs API resolves a logical key to a row and the workflow moves the
 * bytes itself:
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
import { join } from "node:path";
import { extractTarToDir, writePathAsTar } from "@virtool/archive/tar";
import { Cache, CacheRegistered } from "@virtool/contracts";
import type { StorageBackend } from "@virtool/storage";
import { cacheKey } from "@virtool/storage";
import type { JobsApiClient } from "../client/client";
import { NotFoundError } from "../client/errors";
import { downloadToPath, uploadFromPath } from "../files/transfer";
import { type CacheParams, toJsonCacheParams } from "./key";

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
 * A uuid as `uuid4().hex` — 32 lowercase hex characters, matching what Python
 * writes and what `CacheUuid` accepts.
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

				await downloadToPath(storage, cache.storageKey, archivePath);

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
