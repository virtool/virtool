import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunSubprocess } from "@virtool/workflow";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
	eliminateSubtraction,
	findCandidateSequenceIds,
	runExpectationMaximization,
	subtractionProc,
} from "./pathoscopeCore";

async function tempDir(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "pathoscope-core-"));

	onTestFinished(() => rm(directory, { force: true, recursive: true }));

	return directory;
}

/** Stands in for the binary, writing what it would have written to `--output`. */
function coreWriting(results: unknown): RunSubprocess {
	return vi.fn(async (options) => {
		const outputIndex = options.command.indexOf("--output");

		await writeFile(
			options.command[outputIndex + 1] ?? "",
			JSON.stringify(results),
		);

		return {
			command: options.command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	});
}

describe("findCandidateSequenceIds", () => {
	it("reads the sequence ids back from the results file", async () => {
		const outputPath = join(await tempDir(), "candidates.json");
		const runSubprocess = coreWriting(["seq_a", "seq_b"]);

		await expect(
			findCandidateSequenceIds(
				{ runSubprocess, outputPath },
				{
					indexPrefix: "/work/reference_index/reference",
					pScoreCutoff: 0.01,
					proc: 4,
					readPaths: ["/work/reads/reads_1.fq.gz"],
				},
			),
		).resolves.toEqual(["seq_a", "seq_b"]);
	});

	// Repeated `--reads`, unlike `bowtie2 -U`'s comma-separated list. The two
	// spellings are not interchangeable.
	it("repeats --reads once per read file", async () => {
		const outputPath = join(await tempDir(), "candidates.json");
		const runSubprocess = coreWriting([]);

		await findCandidateSequenceIds(
			{ runSubprocess, outputPath },
			{
				indexPrefix: "/work/reference_index/reference",
				pScoreCutoff: 0.01,
				proc: 4,
				readPaths: ["/work/reads/reads_1.fq.gz", "/work/reads/reads_2.fq.gz"],
			},
		);

		expect(vi.mocked(runSubprocess).mock.calls[0]?.[0].command).toEqual([
			"pathoscope-core",
			"candidates",
			"--index",
			"/work/reference_index/reference",
			"--reads",
			"/work/reads/reads_1.fq.gz",
			"--reads",
			"/work/reads/reads_2.fq.gz",
			"--proc",
			"4",
			"--p-score-cutoff",
			"0.01",
			"--output",
			outputPath,
		]);
	});
});

describe("eliminateSubtraction", () => {
	it("returns the eliminated read count", async () => {
		const outputPath = join(await tempDir(), "eliminate.json");

		await expect(
			eliminateSubtraction(
				{ runSubprocess: coreWriting({ subtracted: 17 }), outputPath },
				{
					inputFastqPath: "/work/current_fastq.fq",
					outputFastqPath: "/work/filtered_fastq.fq",
					isolateAlignmentsPath: "/work/isolates/to_isolates.bam",
					subtractionAlignmentsPath: "/work/to_subtraction.bam",
					outputAlignmentsPath: "/work/subtracted.bam",
					proc: 3,
				},
			),
		).resolves.toBe(17);
	});

	// Format-neutral flag names, not the SAM-flavoured PyO3 parameter names they
	// replaced, and `--output` is the JSON results file rather than the alignments.
	it("uses the format-neutral alignment flags", async () => {
		const outputPath = join(await tempDir(), "eliminate.json");
		const runSubprocess = coreWriting({ subtracted: 0 });

		await eliminateSubtraction(
			{ runSubprocess, outputPath },
			{
				inputFastqPath: "/work/current_fastq.fq",
				outputFastqPath: "/work/filtered_fastq.fq",
				isolateAlignmentsPath: "/work/isolates/to_isolates.bam",
				subtractionAlignmentsPath: "/work/to_subtraction.bam",
				outputAlignmentsPath: "/work/subtracted.bam",
				proc: 3,
			},
		);

		expect(vi.mocked(runSubprocess).mock.calls[0]?.[0].command).toEqual([
			"pathoscope-core",
			"eliminate-subtraction",
			"--isolate-alignments",
			"/work/isolates/to_isolates.bam",
			"--subtraction-alignments",
			"/work/to_subtraction.bam",
			"--output-alignments",
			"/work/subtracted.bam",
			"--input-fastq",
			"/work/current_fastq.fq",
			"--output-fastq",
			"/work/filtered_fastq.fq",
			"--proc",
			"3",
			"--output",
			outputPath,
		]);
	});
});

describe("runExpectationMaximization", () => {
	// The core emits a count rather than the read names, which at ordinary
	// Illumina depths were hundreds of megabytes of JSON — past V8's maximum
	// string length, and so a failure in the run's last step.
	it("reads the read count back from the results file", async () => {
		const outputPath = join(await tempDir(), "em.json");
		const runSubprocess = coreWriting({
			refs: ["seq_a"],
			read_count: 12345,
			coverage: {},
		});

		const results = await runExpectationMaximization(
			{ runSubprocess, outputPath },
			{ alignmentPath: "/work/subtracted.bam", pScoreCutoff: 0.01 },
		);

		expect(results.read_count).toBe(12345);
	});

	// Singular, and unchanged from the PyO3 shim's parameter name.
	it("passes the alignment as --alignment", async () => {
		const outputPath = join(await tempDir(), "em.json");
		const runSubprocess = coreWriting({ refs: [], read_count: 0 });

		await runExpectationMaximization(
			{ runSubprocess, outputPath },
			{ alignmentPath: "/work/subtracted.bam", pScoreCutoff: 0.01 },
		);

		expect(vi.mocked(runSubprocess).mock.calls[0]?.[0].command).toEqual([
			"pathoscope-core",
			"em",
			"--alignment",
			"/work/subtracted.bam",
			"--p-score-cutoff",
			"0.01",
			"--output",
			outputPath,
		]);
	});
});

describe("subtractionProc", () => {
	it("gives the core one fewer thread than the run has", () => {
		expect(subtractionProc(4)).toBe(3);
	});

	// Python passes `proc - 1` and its PyO3 shim took a bare `u32`, so a
	// single-core run handed the core a zero. The CLI validates `--proc` as
	// `range(1..)` and would refuse it.
	it("never asks for fewer than one thread", () => {
		expect(subtractionProc(1)).toBe(1);
	});
});
