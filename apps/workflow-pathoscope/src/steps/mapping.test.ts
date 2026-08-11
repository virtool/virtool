import { join } from "node:path";
import type { RunSubprocess, RunSubprocessOptions } from "@virtool/workflow";
import {
	createFakeContext,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { PathoscopeData } from "../context";
import { workPaths } from "../paths";
import type { PathoscopeState } from "../state";
import { mapIsolatesStep } from "./mapping";

const PIPEFAIL_PREFIX = "set -o pipefail; ";

/**
 * Run the isolate mapping step, capturing the bash pipeline it composes.
 *
 * The step itself touches no file — bowtie2 and samtools do — so the fake runner
 * only records.
 */
async function runStep(readNames: readonly string[]) {
	const { path: workPath, cleanup } = await createTestWorkPath();
	onTestFinished(cleanup);

	const scripts: string[] = [];

	const runSubprocess: RunSubprocess = async (
		options: RunSubprocessOptions,
	) => {
		scripts.push(options.command[2] ?? "");

		return {
			command: options.command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	};

	const paths = workPaths(workPath);

	const data: PathoscopeData = {
		analysisId: 1,
		index: {
			id: 1,
			storageKey: "indexes/1/artifact",
			path: paths.collapsedReference,
		},
		reads: readNames.map((name) => ({
			storageKey: `samples/1/${name}`,
			path: join(workPath, "reads", name),
		})),
		subtractions: [],
		pScoreCutoff: 0.01,
	};

	const state: PathoscopeState = {
		candidateSequenceIds: ["seq_a"],
		subtractedCount: 0,
	};

	await mapIsolatesStep.run(
		createFakeContext(data, state, { workPath, runSubprocess }),
	);

	return { paths, script: scripts[0] ?? "", scripts };
}

describe("mapIsolatesStep", () => {
	// Without it a bowtie2 killed part way through leaves a truncated BAM that
	// samtools closes cleanly, and the pipeline reports success.
	it("runs its pipeline with pipefail set", async () => {
		const { script } = await runStep(["reads_1.fq.gz"]);

		expect(script.startsWith(PIPEFAIL_PREFIX)).toBe(true);
	});

	it("quotes every path it interpolates into the pipeline", async () => {
		const { paths, script } = await runStep(["reads_1.fq.gz"]);

		expect(script).toContain(`--al '${paths.isolateFastq}'`);
		expect(script).toContain(`-x '${paths.isolateIndexPrefix}'`);
		expect(script).toContain(`-o '${paths.isolateBam}'`);
	});

	// A read name is a database value, and `bowtie2 -U` takes one comma-separated
	// list — so each path is quoted on its own and the commas stay separators.
	it("quotes each read path and joins them with commas", async () => {
		const { paths, script } = await runStep(["reads 1.fq.gz", "reads_2.fq.gz"]);

		expect(script).toContain(
			`-U '${paths.read("reads 1.fq.gz")}','${paths.read("reads_2.fq.gz")}'`,
		);
	});

	it("skips the mapping when no candidate otus were found", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();
		onTestFinished(cleanup);

		const paths = workPaths(workPath);

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
			subtractions: [],
			pScoreCutoff: 0.01,
		};

		const state: PathoscopeState = {
			candidateSequenceIds: [],
			subtractedCount: 0,
		};

		const runSubprocess: RunSubprocess = () => {
			throw new Error("ran a subprocess with no candidate otus");
		};

		await expect(
			mapIsolatesStep.run(
				createFakeContext(data, state, { workPath, runSubprocess }),
			),
		).resolves.toBeUndefined();
	});
});
