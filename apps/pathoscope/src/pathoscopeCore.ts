/**
 * Driving `pathoscope-core` as a subprocess.
 *
 * The EM core is Rust and stays Rust; what changed in the port is how it is
 * reached. Python loaded it as a PyO3 extension module and called it in-process;
 * here it is a fifth binary beside bowtie2, bowtie2-build, samtools and
 * cd-hit-est, run through the same injected subprocess runner and writing its
 * results to a file this side reads back. **Nothing crosses a pipe, and there is
 * no FFI** — no napi-rs, no native module loaded into the Node process.
 *
 * Every subcommand takes `--output` naming a JSON results file. stdout carries
 * nothing at all, so a stray `println!` in the core cannot corrupt a result;
 * diagnostics arrive on stderr as JSON lines and the runtime logs them.
 */

import { readFile } from "node:fs/promises";
import type { RunSubprocess } from "@virtool/workflow";

const PATHOSCOPE_CORE_TOOL = "pathoscope-core";

/**
 * The `em` subcommand's results file — `PathoscopeResults` in `lib.rs`, as
 * serde writes it.
 *
 * Field names are the Rust struct's, `snake_case`, and are not renamed on the
 * way through: this is the core's contract, and the arrays are read positionally
 * against each other in {@link import("./report").buildReport}.
 */
export type PathoscopeEmResults = {
	best_hit_initial_reads: number[];
	best_hit_initial: number[];
	level_1_initial: number[];
	level_2_initial: number[];
	best_hit_final_reads: number[];
	best_hit_final: number[];
	level_1_final: number[];
	level_2_final: number[];
	init_pi: number[];
	pi: number[];

	/** The reference sequence ids, parallel to every array above */
	refs: string[];

	/**
	 * How many distinct reads the alignment carried.
	 *
	 * A count rather than the read names. Only the number was ever used, and at
	 * ordinary Illumina depths the names run to hundreds of megabytes of JSON —
	 * past V8's maximum string length, which failed the run in its last step.
	 */
	read_count: number;

	/** Per-position depth for each reference, as long as the reference itself */
	coverage: Record<string, number[]>;
};

/** Options shared by every subcommand invocation. */
type CoreRun = {
	runSubprocess: RunSubprocess;
	/** Where the subcommand writes its JSON results. */
	outputPath: string;
};

/**
 * Run one subcommand and read back what it wrote.
 *
 * The results file is read whole. That is safe for `candidates` and
 * `eliminate-subtraction`, whose outputs are a sequence-id list and a single
 * count; `em`'s is the one to watch, because it carries a per-position depth
 * array as long as every reference the sample hit.
 */
async function runCore<T>(
	{ runSubprocess, outputPath }: CoreRun,
	args: readonly string[],
): Promise<T> {
	await runSubprocess({ command: [PATHOSCOPE_CORE_TOOL, ...args] });

	return JSON.parse(await readFile(outputPath, "utf8")) as T;
}

/**
 * Find the candidate OTUs a sample's reads map to.
 *
 * **Rust drives bowtie2 itself and streams its SAM output**, which is the whole
 * reason this is a subcommand rather than a shell pipeline here: the SAM never
 * lands on disk and never enters this process.
 *
 * @returns the candidate sequence ids, sorted by the core so the results file is
 *   stable across runs.
 */
export async function findCandidateSequenceIds(
	run: CoreRun,
	{
		indexPrefix,
		pScoreCutoff,
		proc,
		readPaths,
	}: {
		indexPrefix: string;
		pScoreCutoff: number;
		proc: number;
		readPaths: readonly string[];
	},
): Promise<string[]> {
	return runCore<string[]>(run, [
		"candidates",
		"--index",
		indexPrefix,
		// Repeated once per read file, unlike `map_isolates`' comma-joined
		// `bowtie2 -U`. The two spellings are not interchangeable.
		...readPaths.flatMap((path) => ["--reads", path]),
		"--proc",
		String(proc),
		"--p-score-cutoff",
		String(pScoreCutoff),
		"--output",
		run.outputPath,
	]);
}

/**
 * Drop alignments whose read aligned at least as well to a subtraction.
 *
 * The two FASTQ paths must differ. The core creates its output before reading a
 * byte of its input, so naming one path for both truncates the reads it was
 * asked to filter and every later subtraction pass sees an empty file.
 *
 * @returns the number of reads eliminated.
 */
export async function eliminateSubtraction(
	run: CoreRun,
	{
		inputFastqPath,
		isolateAlignmentsPath,
		outputAlignmentsPath,
		outputFastqPath,
		proc,
		subtractionAlignmentsPath,
	}: {
		inputFastqPath: string;
		isolateAlignmentsPath: string;
		outputAlignmentsPath: string;
		outputFastqPath: string;
		proc: number;
		subtractionAlignmentsPath: string;
	},
): Promise<number> {
	const { subtracted } = await runCore<{ subtracted: number }>(run, [
		"eliminate-subtraction",
		// Format-neutral flag names, not the SAM-flavoured PyO3 parameter names
		// they replaced. Every call site passes BAM.
		"--isolate-alignments",
		isolateAlignmentsPath,
		"--subtraction-alignments",
		subtractionAlignmentsPath,
		"--output-alignments",
		outputAlignmentsPath,
		"--input-fastq",
		inputFastqPath,
		"--output-fastq",
		outputFastqPath,
		"--proc",
		String(proc),
		"--output",
		run.outputPath,
	]);

	return subtracted;
}

/** Reassign multi-mapping reads by expectation maximization. */
export function runExpectationMaximization(
	run: CoreRun,
	{
		alignmentPath,
		pScoreCutoff,
	}: { alignmentPath: string; pScoreCutoff: number },
): Promise<PathoscopeEmResults> {
	return runCore<PathoscopeEmResults>(run, [
		"em",
		// Singular, and unchanged from the PyO3 shim's parameter name.
		"--alignment",
		alignmentPath,
		"--p-score-cutoff",
		String(pScoreCutoff),
		"--output",
		run.outputPath,
	]);
}

/**
 * The thread count `eliminate-subtraction` is given.
 *
 * Python passes `proc - 1` and its PyO3 shim accepted a bare `u32`, so a run
 * with `proc = 1` handed the core a zero. The CLI validates `--proc` as
 * `range(1..)` and would refuse it, turning a working single-core run into a
 * failed one — so the floor is applied here rather than left to clap.
 */
export function subtractionProc(proc: number): number {
	return Math.max(1, proc - 1);
}
