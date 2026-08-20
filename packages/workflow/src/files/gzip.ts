/**
 * Gzip through `pigz`, which every workflow image installs.
 *
 * `@virtool/archive`'s in-process helpers are single threaded, and these files
 * run to several gigabytes on a pod sized with `VT_PROC` cores. They are here
 * rather than there because they need a tool on `PATH` and a core count.
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

// `-c` rather than pigz's in-place mode, which names its own output next to the
// input and would leave every caller renaming a file.
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
