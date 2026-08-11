import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunSubprocess } from "@virtool/workflow";
import { createTestWorkPath } from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { runSkewer } from "./skewer";

/**
 * Run skewer against a fake that writes the files the real one would.
 *
 * `outputs` names the files to create in skewer's staging directory, which the
 * step then renames. Skewer names its output by what it *did* — one file for a
 * single input, a `pair1`/`pair2` set for two — and that is what the renaming
 * branches on.
 */
async function run(
	outputs: readonly string[],
	{ readCount = 1 }: { readCount?: number } = {},
) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const readsDir = join(workPath, "reads");
	await mkdir(readsDir, { recursive: true });

	const reads = Array.from({ length: readCount }, (_read, index) =>
		join(readsDir, `reads_${index + 1}.fq.gz`),
	);

	for (const path of reads) {
		await writeFile(path, "reads");
	}

	const outputPath = join(workPath, "trimmed");
	const calls: Parameters<RunSubprocess>[0][] = [];

	const runSubprocess: RunSubprocess = async (options) => {
		calls.push(options);

		// `-o` is `<staging>/reads`, so the staging directory is its parent.
		const prefix = options.command[options.command.indexOf("-o") + 1] ?? "";
		const staging = prefix.slice(0, prefix.lastIndexOf("/"));

		for (const name of outputs) {
			await writeFile(join(staging, name), name);
		}

		return {
			command: options.command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	};

	await runSkewer({
		minLength: 100,
		mode: reads.length > 1 ? "pe" : "any",
		outputPath,
		proc: 4,
		readPaths: reads,
		runSubprocess,
		stagingParent: workPath,
	});

	return { calls, outputPath, workPath };
}

const PAIRED_OUTPUTS = [
	"reads-trimmed.log",
	"reads-trimmed-pair1.fastq.gz",
	"reads-trimmed-pair2.fastq.gz",
];

const SINGLE_OUTPUTS = ["reads-trimmed.log", "reads-trimmed.fastq.gz"];

describe("runSkewer", () => {
	// The flag order has no effect on skewer, but the command is what a failed
	// run is debugged from and a reordered one is needlessly hard to diff against
	// Python's.
	it("builds Python's command, in Python's order", async () => {
		const { calls } = await run(SINGLE_OUTPUTS);

		const command = calls[0]?.command ?? [];

		expect(command.slice(0, 15)).toEqual([
			"skewer",
			"-r",
			"0.1",
			"-d",
			"0.03",
			"-m",
			"any",
			"-l",
			"100",
			"-q",
			"20",
			"-Q",
			"25",
			"-t",
			"4",
		]);

		expect(command).toContain("--quiet");
		expect(command).toContain("-z");
	});

	it("passes every read path last, after the options", async () => {
		const { calls, workPath } = await run(PAIRED_OUTPUTS, { readCount: 2 });

		expect(calls[0]?.command.slice(-2)).toEqual([
			join(workPath, "reads", "reads_1.fq.gz"),
			join(workPath, "reads", "reads_2.fq.gz"),
		]);
	});

	// Python runs skewer from the reads' own directory.
	it("runs from the reads' directory", async () => {
		const { calls, workPath } = await run(SINGLE_OUTPUTS);

		expect(calls[0]?.cwd).toBe(join(workPath, "reads"));
	});

	// Skewer in the tools image is linked against libraries the runtime base keeps
	// here rather than on the default search path.
	it("sets LD_LIBRARY_PATH", async () => {
		const { calls } = await run(SINGLE_OUTPUTS);

		expect(calls[0]?.env).toEqual({
			LD_LIBRARY_PATH: "/usr/lib/x86_64-linux-gnu",
		});
	});

	it("renames a single-end run's output to reads_1.fq.gz", async () => {
		const { outputPath } = await run(SINGLE_OUTPUTS);

		expect((await readdir(outputPath)).sort()).toEqual([
			"reads_1.fq.gz",
			"trim.log",
		]);

		await expect(
			readFile(join(outputPath, "reads_1.fq.gz"), "utf8"),
		).resolves.toBe("reads-trimmed.fastq.gz");
	});

	it("renames a paired run's output to reads_1 and reads_2", async () => {
		const { outputPath } = await run(PAIRED_OUTPUTS);

		expect((await readdir(outputPath)).sort()).toEqual([
			"reads_1.fq.gz",
			"reads_2.fq.gz",
			"trim.log",
		]);

		await expect(
			readFile(join(outputPath, "reads_2.fq.gz"), "utf8"),
		).resolves.toBe("reads-trimmed-pair2.fastq.gz");
	});

	// Python catches a `FileNotFoundError` on the single-end name to decide this.
	// Testing for the file instead means a genuinely absent paired output still
	// fails naming itself, rather than being read as "must have been single-end".
	it("fails naming the missing file when neither output is there", async () => {
		await expect(run(["reads-trimmed.log"])).rejects.toThrow(
			/reads-trimmed-pair1\.fastq\.gz/,
		);
	});

	it("refuses to run with no reads", async () => {
		await expect(run(SINGLE_OUTPUTS, { readCount: 0 })).rejects.toThrow(
			/no reads/,
		);
	});
});
