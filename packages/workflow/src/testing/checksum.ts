/**
 * Checksums over **decompressed** content.
 *
 * gzip embeds an mtime and varies by compressor and level, so `pigz` and
 * `node:zlib` produce different bytes from identical input. Hashing the
 * compressed bytes would fail every comparison against a Python-produced fixture
 * for reasons that have nothing to do with correctness — so a gzipped file is
 * piped through `createGunzip()` first and a plain one is hashed as it stands.
 * The two therefore agree, which is the property that makes a checksum usable as
 * a workflow assertion at all.
 *
 * Gzip detection is `isGzipped` from the file layer, not a second copy of the
 * magic-number check. `decompressFile` is deliberately *not* used: it writes a
 * second file, and there is nothing to hash from a path this only needs a stream
 * of.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { isGzipped } from "@virtool/archive/compression";

/**
 * The digest of a file's decompressed content, as lowercase hex.
 *
 * Streamed, because these files run to many gigabytes and a fixture that read
 * one into memory would be the only part of the harness that could not be
 * pointed at a real workflow output.
 */
export async function checksumFile(path: string): Promise<string> {
	const hash = createHash("sha256");

	if (await isGzipped(path)) {
		await pipeline(createReadStream(path), createGunzip(), hash);
	} else {
		await pipeline(createReadStream(path), hash);
	}

	return hash.digest("hex");
}

async function* walk(root: string, directory: string): AsyncGenerator<string> {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const full = join(directory, entry.name);

		if (entry.isDirectory()) {
			yield* walk(root, full);
		} else if (entry.isFile()) {
			yield full;
		}
	}
}

/**
 * Every file under `path`, keyed by its path relative to `path`.
 *
 * One assertion covers a whole output tree, which is what makes a ported
 * workflow's outputs comparable to Python's without listing them by hand.
 * Separators are normalised to `/` and the keys are sorted, so the object
 * compares equal regardless of directory order.
 *
 * Symbolic links and device nodes are skipped rather than followed — a link out
 * of the tree would put a file the test does not own into its digest.
 */
export async function checksumDirectory(
	path: string,
): Promise<Record<string, string>> {
	const files: string[] = [];

	for await (const file of walk(path, path)) {
		files.push(file);
	}

	files.sort();

	const digests = await Promise.all(files.map((file) => checksumFile(file)));

	return Object.fromEntries(
		files.map((file, index) => [
			relative(path, file).split(sep).join("/"),
			digests[index] as string,
		]),
	);
}
