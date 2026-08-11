import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunSubprocess, RunSubprocessOptions } from "@virtool/workflow";
import {
	createFakeContext,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { PathoscopeData, PathoscopeSubtraction } from "../context";
import { workPaths } from "../paths";
import type { PathoscopeState } from "../state";
import { eliminateSubtractionStep } from "./eliminateSubtraction";

function fastq(...readIds: readonly string[]): string {
	return readIds.map((id) => `@${id}\nACGT\n+\nIIII\n`).join("");
}

function parseFastqIds(contents: string): string[] {
	const lines = contents.split("\n");
	const ids: string[] = [];

	for (let index = 0; index + 3 < lines.length; index += 4) {
		ids.push((lines[index] ?? "").slice(1));
	}

	return ids;
}

function flagValue(command: readonly string[], flag: string): string {
	return command[command.indexOf(flag) + 1] ?? "";
}

const PIPEFAIL_PREFIX = "set -o pipefail; ";

/**
 * The value of a flag in a bash pipeline, unquoted.
 *
 * The `set -o pipefail` prefix is dropped before the split, or its own `-o`
 * would answer for samtools'. Naive otherwise: no path here carries a space.
 */
function shellFlagValue(script: string, flag: string): string {
	const tokens = script.startsWith(PIPEFAIL_PREFIX)
		? script.slice(PIPEFAIL_PREFIX.length).split(/\s+/)
		: script.split(/\s+/);

	return unquote(tokens[tokens.indexOf(flag) + 1] ?? "");
}

function unquote(token: string): string {
	if (!token.startsWith("'") || !token.endsWith("'")) {
		return token;
	}

	return token.slice(1, -1).replaceAll(`'\\''`, "'");
}

/**
 * Stands in for bowtie2, samtools and `pathoscope-core`, on a real work path.
 *
 * The core is modelled down to the order it touches the two FASTQ paths — input
 * opened, output created, and only then a byte read — because that ordering is
 * what makes writing in place destroy the reads being filtered.
 */
function createFakeTools(eliminationsPerPass: readonly (readonly string[])[]) {
	const bowtie2Inputs: string[] = [];
	const scripts: string[] = [];
	let pass = 0;

	async function runCore(command: readonly string[]): Promise<void> {
		const input = await open(flagValue(command, "--input-fastq"), "r");
		const output = await open(flagValue(command, "--output-fastq"), "w");

		const contents = await input.readFile("utf8");
		await input.close();

		const eliminated = new Set(eliminationsPerPass[pass] ?? []);
		const kept = parseFastqIds(contents).filter((id) => !eliminated.has(id));

		await output.writeFile(fastq(...kept));
		await output.close();

		pass += 1;

		await writeFile(flagValue(command, "--output-alignments"), "");
		await writeFile(
			flagValue(command, "--output"),
			JSON.stringify({
				subtracted: parseFastqIds(contents).length - kept.length,
			}),
		);
	}

	const runSubprocess: RunSubprocess = async (
		options: RunSubprocessOptions,
	) => {
		const { command } = options;
		const script = command[2] ?? "";

		if (command[0] === "bash") {
			scripts.push(script);

			bowtie2Inputs.push(
				await readFile(shellFlagValue(script, "-U"), "utf8").catch(() => ""),
			);

			await writeFile(shellFlagValue(script, "-o"), "");
		} else {
			await runCore(command);
		}

		return {
			command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	};

	return { bowtie2Inputs, runSubprocess, scripts };
}

function createSubtraction(id: number): PathoscopeSubtraction {
	return {
		id,
		name: `subtraction ${id}`,
		storageKey: `subtractions/${id}/genome`,
		path: `/work/${id}.fa.gz`,
	};
}

/** Run the step over a real work path seeded with three isolate-mapped reads. */
async function runStep(
	eliminationsPerPass: readonly (readonly string[])[],
	subtractionCount: number,
) {
	const { path: workPath, cleanup } = await createTestWorkPath();
	onTestFinished(cleanup);

	const paths = workPaths(workPath);

	await mkdir(paths.isolatesDir, { recursive: true });
	await writeFile(paths.isolateFastq, fastq("r1", "r2", "r3"));
	await writeFile(paths.isolateBam, "");

	const tools = createFakeTools(eliminationsPerPass);

	const data: PathoscopeData = {
		analysisId: 1,
		index: {
			id: 1,
			storageKey: "indexes/1/artifact",
			path: paths.collapsedReference,
		},
		reads: [
			{
				storageKey: "samples/1/reads_1.fq.gz",
				path: join(workPath, "reads", "reads_1.fq.gz"),
			},
		],
		subtractions: Array.from({ length: subtractionCount }, (_, index) =>
			createSubtraction(index + 1),
		),
		pScoreCutoff: 0.01,
	};

	const state: PathoscopeState = {
		candidateSequenceIds: ["seq_a"],
		subtractedCount: 0,
	};

	await eliminateSubtractionStep.run(
		createFakeContext(data, state, {
			workPath,
			runSubprocess: tools.runSubprocess,
		}),
	);

	return { ...tools, paths, state };
}

describe("eliminateSubtractionStep", () => {
	it("carries the filtered reads into every later subtraction pass", async () => {
		const { bowtie2Inputs, paths, state } = await runStep([["r1"], ["r2"]], 2);

		expect(parseFastqIds(bowtie2Inputs[0] ?? "")).toEqual(["r1", "r2", "r3"]);
		expect(parseFastqIds(bowtie2Inputs[1] ?? "")).toEqual(["r2", "r3"]);

		expect(parseFastqIds(await readFile(paths.currentFastq, "utf8"))).toEqual([
			"r3",
		]);

		expect(state.subtractedCount).toBe(2);
	});

	// Without it a bowtie2 killed part way through leaves a truncated BAM that
	// samtools closes cleanly, and the pipeline reports success.
	it("runs its pipeline with pipefail set", async () => {
		const { scripts } = await runStep([["r1"], ["r2"]], 2);

		expect(scripts).toHaveLength(2);

		for (const script of scripts) {
			expect(script.startsWith(PIPEFAIL_PREFIX)).toBe(true);
		}
	});

	// Nothing reads what bowtie2 wrote with `--al` after this step, and it runs to
	// gigabytes on a pod whose disk is sized for one copy.
	it("moves the isolate fastq rather than copying it", async () => {
		const { paths } = await runStep([["r1"]], 1);

		await expect(readFile(paths.isolateFastq, "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	it("quotes every path it interpolates into the pipeline", async () => {
		const { paths, scripts } = await runStep([["r1"]], 1);
		const script = scripts[0] ?? "";

		expect(script).toContain(`-U '${paths.currentFastq}'`);
		expect(script).toContain(`-o '${paths.toSubtractionBam}'`);
		expect(script).toContain(`-x '${paths.subtraction(1).indexPrefix}'`);
	});
});
