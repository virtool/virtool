/**
 * Gzip helpers.
 *
 * Compression runs in-process: checksums are taken over *decompressed* content,
 * so the gzip bytes need not be reproducible and there is nothing to gain from
 * matching another compressor. Workflow steps use `@virtool/workflow`'s
 * `gzipFile`, which runs `pigz` across the pod's cores.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

// The two-byte gzip magic number, RFC 1952 §2.3.1.
const GZIP_MAGIC = [0x1f, 0x8b];

// The bzip2 stream header: `BZh`, then a block size digit from `1` to `9`.
const BZIP2_MAGIC = [0x42, 0x5a, 0x68];
const BZIP2_HEADER_LENGTH = BZIP2_MAGIC.length + 1;
const BZIP2_MIN_BLOCK_SIZE = 0x31;
const BZIP2_MAX_BLOCK_SIZE = 0x39;

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
 * Reads **two bytes and stops**. Decoding a member header to decide would read
 * far more than it needs, and these files are large enough that the difference
 * matters.
 *
 * A file shorter than two bytes is not gzipped.
 */
export async function isGzipped(path: string): Promise<boolean> {
	const start = await readStart(path, GZIP_MAGIC.length);

	return (
		start.length === GZIP_MAGIC.length &&
		GZIP_MAGIC.every((byte, index) => start[index] === byte)
	);
}

/**
 * Whether the file at `path` starts with a bzip2 stream header.
 *
 * Reads four bytes and stops. A file shorter than the header is not bzip2.
 */
export async function isBzip2(path: string): Promise<boolean> {
	const start = await readStart(path, BZIP2_HEADER_LENGTH);
	const blockSize = start[BZIP2_MAGIC.length];

	return (
		blockSize !== undefined &&
		blockSize >= BZIP2_MIN_BLOCK_SIZE &&
		blockSize <= BZIP2_MAX_BLOCK_SIZE &&
		BZIP2_MAGIC.every((byte, index) => start[index] === byte)
	);
}

/** The first `length` bytes of the file at `path`, or fewer if it is shorter. */
async function readStart(path: string, length: number): Promise<Buffer> {
	const handle = await open(path, "r");

	try {
		const { bytesRead, buffer } = await handle.read(
			Buffer.alloc(length),
			0,
			length,
			0,
		);

		return buffer.subarray(0, bytesRead);
	} finally {
		await handle.close();
	}
}
