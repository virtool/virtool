/**
 * The only two functions that move bytes between object storage and the work
 * path.
 *
 * Workflow files run to many gigabytes — Bowtie2 indexes, FASTQ reads, a
 * 200–500 MB index artifact — so **nothing here may buffer**. `readFile`,
 * `Buffer.concat` over an object, or draining `storage.read(key)` into an array
 * reintroduce exactly the out-of-memory risk streaming exists to avoid, and a
 * fixture that reaches for one of those instead of these two functions is the
 * way that risk comes back.
 *
 * `StorageBackend.read` yields an `AsyncIterable<Uint8Array>` and `write`
 * consumes one, so both compose with Node's streams without an adapter.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import {
	type DecompressGzipToFileOptions,
	decompressGzipToFile,
} from "@virtool/archive/compression";
import type { StorageBackend } from "@virtool/storage";

/**
 * Stream the object at `key` to `path`, creating its parent directory first.
 *
 * `pipeline` destroys both ends and propagates the original error if either
 * side fails, so a failed download cannot leave a dangling write stream holding
 * a partial file open.
 *
 * @throws {StorageKeyNotFoundError} when no object is stored under `key`.
 */
export async function downloadToPath(
	storage: StorageBackend,
	key: string,
	path: string,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });

	await pipeline(storage.read(key), createWriteStream(path));
}

/**
 * Stream the gzip object at `key` into a decompressed file at `path`.
 *
 * No compressed copy is retained on disk and neither representation is
 * buffered in memory.
 */
export async function downloadGzipToPath(
	storage: StorageBackend,
	key: string,
	path: string,
	options?: DecompressGzipToFileOptions,
): Promise<void> {
	await decompressGzipToFile(storage.read(key), path, options);
}

/**
 * Stream the file at `path` to `key`, returning the byte count storage reports.
 *
 * The returned count is what the backend actually wrote, not a `stat` taken
 * beforehand — the two disagree if the file is still being appended to.
 */
export async function uploadFromPath(
	storage: StorageBackend,
	key: string,
	path: string,
): Promise<number> {
	return storage.write(key, createReadStream(path));
}
