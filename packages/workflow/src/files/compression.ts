/**
 * Gzip helpers, ported from `compress_file`, `decompress_file` and `is_gzipped`
 * in Python's `virtool/utils.py`.
 *
 * Python's versions branch to `pigz` when more than one process is available.
 * That branch is dropped: it exists for parallelism, and checksums are taken
 * over *decompressed* content, so our gzip bytes need not match pigz's.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

// The two-byte gzip magic number, RFC 1952 §2.3.1.
const GZIP_MAGIC = [0x1f, 0x8b];

/** Gzip `source` to `target`, creating `target`'s parent directory first. */
export async function compressFile(
	source: string,
	target: string,
): Promise<void> {
	await mkdir(dirname(target), { recursive: true });

	await pipeline(
		createReadStream(source),
		createGzip(),
		createWriteStream(target),
	);
}

/** Gunzip `source` to `target`, creating `target`'s parent directory first. */
export async function decompressFile(
	source: string,
	target: string,
): Promise<void> {
	await mkdir(dirname(target), { recursive: true });

	await pipeline(
		createReadStream(source),
		createGunzip(),
		createWriteStream(target),
	);
}

/**
 * Whether the file at `path` starts with the gzip magic number.
 *
 * Reads **two bytes and stops**. Python opens the whole file through
 * `gzip.open(...).peek(1)` and decides on the exception message, which decodes
 * a member header and can read far more than it needs; these files are large
 * enough that the difference is worth the divergence.
 *
 * A file shorter than two bytes is not gzipped.
 */
export async function isGzipped(path: string): Promise<boolean> {
	const handle = await open(path, "r");

	try {
		const { bytesRead, buffer } = await handle.read(
			Buffer.alloc(GZIP_MAGIC.length),
			0,
			GZIP_MAGIC.length,
			0,
		);

		return (
			bytesRead === GZIP_MAGIC.length &&
			GZIP_MAGIC.every((byte, index) => buffer[index] === byte)
		);
	} finally {
		await handle.close();
	}
}
