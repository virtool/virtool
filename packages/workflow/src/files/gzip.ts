/**
 * Gzip through `pigz`, which every workflow image installs.
 *
 * `@virtool/archive`'s in-process helpers are single threaded, and these files
 * run to several gigabytes on a pod sized with `VT_PROC` cores. They are here
 * rather than there because they need a tool on `PATH` and a core count.
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunSubprocess, SubprocessResult } from "../subprocess/types";

/** What {@link gzipFile} is told about one file. */
export type GzipFileOptions = {
	/** The run's core allocation, passed to `pigz -p`. */
	proc: number;
	runSubprocess: RunSubprocess;
	source: string;
	/** Overwritten if it exists. Its parent directory is created first. */
	target: string;
};

/**
 * `pipefail` makes a failed decompression fail the run. Without it the exit
 * status is `pigz`'s, and a truncated upload becomes a valid, shorter gzip file.
 *
 * The path and the core count are positional parameters, so a user's filename
 * is never parsed as shell syntax.
 */
const BZIP2_TO_GZIP_SCRIPT =
	'set -o pipefail; lbzip2 -d -c -n "$2" -- "$1" | pigz -p "$2" -c';

/** Gzip `source` to `target` with `pigz`, leaving `source` in place. */
export async function gzipFile({
	proc,
	runSubprocess,
	source,
	target,
}: GzipFileOptions): Promise<SubprocessResult> {
	await mkdir(dirname(target), { recursive: true });

	// `-c` rather than pigz's in-place mode, which names its own output next to
	// the input and would leave every caller renaming a file.
	return runSubprocess({
		command: ["pigz", "-p", String(proc), "-c", source],
		stdoutFile: target,
	});
}

/**
 * Convert the bzip2 file `source` to the gzip file `target`, leaving `source`
 * in place.
 *
 * The decompressed bytes go through a pipe, so they never reach the disk. The
 * caller's image must install `lbzip2` as well as `pigz`. `lbzip2` decompresses
 * in parallel whichever tool made the file; `pbzip2` does so only for its own.
 */
export async function recompressBzip2File({
	proc,
	runSubprocess,
	source,
	target,
}: GzipFileOptions): Promise<SubprocessResult> {
	await mkdir(dirname(target), { recursive: true });

	return runSubprocess({
		command: [
			"bash",
			"-c",
			BZIP2_TO_GZIP_SCRIPT,
			"recompress-bzip2",
			source,
			String(proc),
		],
		stdoutFile: target,
	});
}
