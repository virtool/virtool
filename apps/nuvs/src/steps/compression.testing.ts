/**
 * Gzip helpers for tests.
 *
 * Named `.testing.ts` rather than `.test.ts` so `vitest.config.ts` does not
 * collect it as a suite.
 */

import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

/** The decompressed contents of a gzipped file, as UTF-8. */
export async function decompressToString(path: string): Promise<string> {
	return (await gunzipAsync(await readFile(path))).toString("utf8");
}

/** Write `contents` to `path`, gzipped. */
export async function writeGzipped(
	path: string,
	contents: string,
): Promise<void> {
	await writeFile(path, await gzipAsync(Buffer.from(contents, "utf8")));
}
