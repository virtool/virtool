/**
 * Running skewer, ported from `utils.py`'s `skewer` fixture.
 *
 * Skewer is the one tool in this workflow with no runner anywhere else in the
 * repo, so the command and the output renaming both live here.
 *
 * `calculate_skewer_trimming_parameters` is **not** ported. It raises for every
 * library type but `srna` and nothing in the workflow calls it — porting it would
 * transliterate a function whose only reachable path is a `ValueError`.
 */

import { access, mkdir, mkdtemp, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { matchToolVersion, type RunSubprocess } from "@virtool/workflow";

export const SKEWER_TOOL = "skewer";

/** How skewer is told to treat the reads it is given. */
export type SkewerMode = "pe" | "any";

/**
 * Skewer's defaults, as Python's `SkewerConfiguration` declares them.
 *
 * Every one is a field in the `trimmed_reads` cache key, so a change here forks
 * the namespace from Python nuvs'. `max_error_rate` and `max_indel_rate` are
 * Python **floats** and are marked as such where the params are built.
 */
export const SKEWER_END_QUALITY = 20;
export const SKEWER_MAX_ERROR_RATE = 0.1;
export const SKEWER_MAX_INDEL_RATE = 0.03;
export const SKEWER_MEAN_QUALITY = 25;

/**
 * The minimum length skewer keeps, from the sample's longest observed read.
 *
 * Python's `calculate_trimming_min_length`. The library type is a parameter
 * there and unread, so it is not one here.
 */
export function calculateTrimmingMinLength(maxLength: number): number {
	if (maxLength < 80) {
		return 35;
	}

	if (maxLength < 160) {
		return 100;
	}

	return 160;
}

/**
 * How `bowtie2-build` and most other tools announce themselves: a bare `version`
 * followed by the number.
 */
const LABELLED_VERSION = /\bversion\s+(\S+)/;

/**
 * The fallback: the first dotted number anywhere in the output.
 *
 * Skewer prints `skewer version: 0.2.2`, and the colon means
 * {@link LABELLED_VERSION} does not match — `\s+` wants whitespace immediately
 * after the word. Python tries the same two patterns in the same order for the
 * same reason, so dropping this reads the version as unparseable.
 */
const BARE_VERSION = /\bv?([0-9]+(?:\.[0-9A-Za-z_-]+)+)/;

/**
 * Read skewer's version.
 *
 * Both streams are collected, and a non-zero exit is **not** tolerated — unlike
 * `cd-hit-est`, whose help text is its only version output. Python does not
 * catch here either.
 */
export async function getSkewerVersion(
	runSubprocess: RunSubprocess,
): Promise<string> {
	const lines: string[] = [];

	const collect = (line: string) => {
		lines.push(line);
	};

	await runSubprocess({
		command: [SKEWER_TOOL, "--version"],
		stdout: collect,
		stderr: collect,
	});

	return matchToolVersion(
		LABELLED_VERSION.test(lines.join("\n")) ? LABELLED_VERSION : BARE_VERSION,
		lines,
		"Could not parse skewer version",
	);
}

/** What one skewer run needs. */
export type RunSkewerOptions = {
	minLength: number;
	mode: SkewerMode;
	/** Where `reads_1.fq.gz`, its pair and `trim.log` end up. */
	outputPath: string;
	proc: number;
	/** The sample's reads, in pair order. */
	readPaths: readonly string[];
	runSubprocess: RunSubprocess;
	/**
	 * Where skewer writes before its output is renamed.
	 *
	 * On the work path rather than the OS temp directory, which is what Python
	 * uses: the rename below is only atomic — and only free — within one
	 * filesystem, and the work path is the volume a pod is sized for.
	 */
	stagingParent: string;
};

/**
 * Trim `readPaths` into `outputPath`.
 *
 * The flag order is Python's verbatim. It has no effect on skewer's behaviour,
 * but the command is the thing a failed run is debugged from and a reordered one
 * is needlessly hard to diff against Python's.
 */
export async function runSkewer({
	minLength,
	mode,
	outputPath,
	proc,
	readPaths,
	runSubprocess,
	stagingParent,
}: RunSkewerOptions): Promise<void> {
	const [firstRead] = readPaths;

	if (firstRead === undefined) {
		throw new Error("Cannot run skewer with no reads");
	}

	await mkdir(stagingParent, { recursive: true });
	await mkdir(outputPath, { recursive: true });

	const staging = await mkdtemp(join(stagingParent, "skewer-"));

	await runSubprocess({
		command: [
			SKEWER_TOOL,
			"-r",
			String(SKEWER_MAX_ERROR_RATE),
			"-d",
			String(SKEWER_MAX_INDEL_RATE),
			"-m",
			mode,
			"-l",
			String(minLength),
			"-q",
			String(SKEWER_END_QUALITY),
			"-Q",
			String(SKEWER_MEAN_QUALITY),
			"-t",
			String(proc),
			// Skewer spams stdout with progress updates.
			"--quiet",
			// Compress the trimmed output.
			"-z",
			"-o",
			join(staging, "reads"),
			...readPaths,
		],
		// Python runs skewer from the reads' own directory. Nothing in the command
		// is relative, so this only decides where skewer would drop a stray file.
		cwd: dirname(firstRead),
		// Skewer in the tools image is linked against libraries the runtime base
		// keeps here rather than on the default search path.
		env: { LD_LIBRARY_PATH: "/usr/lib/x86_64-linux-gnu" },
	});

	await renameTrimmingResults(staging, outputPath);
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);

		return true;
	} catch {
		return false;
	}
}

/**
 * Move skewer's output to the names the rest of the workflow uses.
 *
 * **Whether the run was paired is read off the output, not off the sample.**
 * Skewer names its files by what it did — `reads-trimmed.fastq.gz` for one input,
 * `reads-trimmed-pair{1,2}.fastq.gz` for two — and that is what Python branches
 * on, by catching the `FileNotFoundError` from the single-end name. Tested here
 * rather than caught, so a genuinely absent paired file still fails naming
 * itself.
 */
async function renameTrimmingResults(
	staging: string,
	outputPath: string,
): Promise<void> {
	await rename(
		join(staging, "reads-trimmed.log"),
		join(outputPath, "trim.log"),
	);

	const singleEnd = join(staging, "reads-trimmed.fastq.gz");

	if (await exists(singleEnd)) {
		await rename(singleEnd, join(outputPath, "reads_1.fq.gz"));

		return;
	}

	await rename(
		join(staging, "reads-trimmed-pair1.fastq.gz"),
		join(outputPath, "reads_1.fq.gz"),
	);

	await rename(
		join(staging, "reads-trimmed-pair2.fastq.gz"),
		join(outputPath, "reads_2.fq.gz"),
	);
}
