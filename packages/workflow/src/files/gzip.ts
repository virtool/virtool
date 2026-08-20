/**
 * Gzip through `pigz`.
 *
 * `@virtool/archive`'s `compressFile` is `node:zlib` in-process and single
 * threaded. A pod is sized with `VT_PROC` cores and the files here run to
 * several gigabytes, so gzipping a sample's reads on one of them leaves the
 * rest of the allocation idle for minutes.
 *
 * These live here rather than in `@virtool/archive` because they need a tool
 * on `PATH` and a core count, and that package promises neither. Every workflow
 * image installs `pigz`; there is no fallback, so a missing one fails the step
 * with `SubprocessSpawnError` rather than quietly running at a seventh of the
 * speed.
 *
 * `pigz -d` is barely parallel — inflating a gzip stream is inherently serial
 * and the extra threads only overlap reads, writes and the CRC — but it is
 * still the faster of the two and keeps one tool doing both directions.
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunSubprocess } from "../subprocess/types";

/** What {@link gzipFile} and {@link gunzipFile} are told about one file. */
export type GzipFileOptions = {
	/** The run's core allocation, passed to `pigz -p`. */
	proc: number;
	runSubprocess: RunSubprocess;
	source: string;
	/** Overwritten if it exists. Its parent directory is created first. */
	target: string;
};

/** Gzip `source` to `target` with `pigz`, leaving `source` in place. */
export async function gzipFile(options: GzipFileOptions): Promise<void> {
	await run(options, ["-c"]);
}

/** Gunzip `source` to `target` with `pigz`, leaving `source` in place. */
export async function gunzipFile(options: GzipFileOptions): Promise<void> {
	await run(options, ["-d", "-c"]);
}

/**
 * Run `pigz` one way or the other.
 *
 * `-c` and a redirected stdout rather than pigz's in-place mode, which names
 * its own output next to the input and would leave every caller renaming a
 * file across whatever directories it chose.
 */
async function run(
	{ proc, runSubprocess, source, target }: GzipFileOptions,
	mode: readonly string[],
): Promise<void> {
	await mkdir(dirname(target), { recursive: true });

	await runSubprocess({
		command: ["pigz", "-p", String(proc), ...mode, source],
		stdoutFile: target,
	});
}
