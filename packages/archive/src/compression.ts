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
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

// The two-byte gzip magic number, RFC 1952 §2.3.1.
const GZIP_MAGIC = [0x1f, 0x8b];

/** Options for streaming a gzip object into a decompressed file. */
export type DecompressGzipToFileOptions = {
	/** Stop the transfer and destroy every pipeline stage when aborted. */
	signal?: AbortSignal;

	/** Refuse output larger than this many decompressed bytes. */
	maxDecompressedBytes?: number;
};

/** Thrown when gzip output exceeds its configured decompressed-byte limit. */
export class DecompressedSizeLimitError extends Error {
	constructor(public readonly limit: number) {
		super(`Decompressed data exceeds the ${limit} byte limit`);
		this.name = "DecompressedSizeLimitError";
	}
}

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
	await decompressGzipToFile(createReadStream(source), target);
}

/**
 * Stream a gzip object into a decompressed file.
 *
 * The compressed input and decompressed output are both consumed incrementally;
 * neither is accumulated in memory. The byte limit counts data leaving gunzip,
 * so it protects against compressed inputs whose stored size is harmless but
 * whose expanded size is not.
 */
export async function decompressGzipToFile(
	source: AsyncIterable<Uint8Array>,
	target: string,
	options: DecompressGzipToFileOptions = {},
): Promise<void> {
	await mkdir(dirname(target), { recursive: true });

	let decompressedBytes = 0;
	const limiter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			decompressedBytes += chunk.length;

			if (
				options.maxDecompressedBytes !== undefined &&
				decompressedBytes > options.maxDecompressedBytes
			) {
				callback(new DecompressedSizeLimitError(options.maxDecompressedBytes));
				return;
			}

			callback(null, chunk);
		},
	});

	await pipeline(source, createGunzip(), limiter, createWriteStream(target), {
		signal: options.signal,
	});
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
