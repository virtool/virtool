import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createIndexArtifact, type IndexOtu } from "@virtool/sqlite";
import type { RunSubprocess, RunSubprocessOptions } from "@virtool/workflow";
import {
	createFakeContext,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { PathoscopeData } from "../context";
import { workPaths } from "../paths";
import type { PathoscopeState } from "../state";
import {
	buildCandidateOtuIndexStep,
	mapIsolatesStep,
	mapRepresentativesStep,
} from "./mapping";

const PIPEFAIL_PREFIX = "set -o pipefail; ";

function createOtu(id: string, sequenceIds: readonly string[]): IndexOtu {
	return {
		abbreviation: id,
		id,
		isolates: [
			{
				default: true,
				id: `${id}_isolate`,
				sequences: sequenceIds.map((sequenceId) => ({
					accession: sequenceId,
					definition: sequenceId,
					host: null,
					id: sequenceId,
					segment: null,
					sequence: "ACGTACGTACGT",
				})),
				source_name: id,
				source_type: "isolate",
			},
		],
		name: id,
		schema: [],
		taxid: null,
		version: 1,
	};
}

describe("mapRepresentativesStep", () => {
	it("stores the distinct OTUs owning candidate representative sequences", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();
		onTestFinished(cleanup);

		const paths = workPaths(workPath);
		const sourcePath = paths.sourceIndex(1);

		await mkdir(join(workPath, "indexes", "1"), { recursive: true });
		await createIndexArtifact(sourcePath, null, [
			createOtu("otu_z", ["seq_a", "seq_b"]),
			createOtu("otu_a", ["seq_c"]),
		]);

		const runSubprocess: RunSubprocess = async (options) => {
			const outputIndex = options.command.indexOf("--output");

			await writeFile(
				options.command[outputIndex + 1] ?? "",
				JSON.stringify(["seq_a", "seq_b", "seq_c"]),
			);

			return {
				cancelled: false,
				command: options.command,
				durationMs: 1,
				exitCode: 0,
				signal: null,
				stderrTail: [],
			};
		};
		const data: PathoscopeData = {
			analysisId: 1,
			index: {
				id: 1,
				path: sourcePath,
				storageKey: "indexes/1/source",
			},
			pScoreCutoff: 0.01,
			reads: [],
			subtractions: [],
		};
		const state: PathoscopeState = {
			candidateOtuIds: [],
			subtractedCount: 0,
		};

		await mapRepresentativesStep.run(
			createFakeContext(data, state, { runSubprocess, workPath }),
		);

		expect(state.candidateOtuIds).toEqual(["otu_a", "otu_z"]);
	});
});

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
		candidateOtuIds: ["otu_a"],
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
		expect(script).toContain(`-x '${paths.candidateOtuIndexPrefix}'`);
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
			candidateOtuIds: [],
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

describe("buildCandidateOtuIndexStep", () => {
	it("writes candidate OTUs from the collapsed reference", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();
		onTestFinished(cleanup);

		const paths = workPaths(workPath);
		const sourcePath = paths.sourceIndex(1);
		const sourceOtu: IndexOtu = {
			abbreviation: "TMV",
			id: "otu_1",
			isolates: [
				{
					default: true,
					id: "isolate_survivor",
					sequences: [
						{
							accession: "AC_1",
							definition: "Surviving sequence",
							host: null,
							id: "seq_survivor",
							segment: null,
							sequence: "ACGTACGTACGT",
						},
					],
					source_name: "survivor",
					source_type: "isolate",
				},
				{
					default: false,
					id: "isolate_removed",
					sequences: [
						{
							accession: "AC_2",
							definition: "Removed representative",
							host: null,
							id: "seq_removed",
							segment: null,
							sequence: "ACGTACGTACGA",
						},
					],
					source_name: "removed",
					source_type: "isolate",
				},
			],
			name: "Tobacco mosaic virus",
			schema: [],
			taxid: 12242,
			version: 3,
		};
		const collapsedOtu: IndexOtu = {
			...sourceOtu,
			isolates: [sourceOtu.isolates[0] as IndexOtu["isolates"][number]],
		};

		await mkdir(paths.collapsedReferenceDir, { recursive: true });
		await createIndexArtifact(paths.collapsedReference, null, [collapsedOtu]);

		const commands: Array<readonly string[]> = [];
		const runSubprocess: RunSubprocess = async (options) => {
			commands.push(options.command);

			return {
				cancelled: false,
				command: options.command,
				durationMs: 1,
				exitCode: 0,
				signal: null,
				stderrTail: [],
			};
		};
		const data: PathoscopeData = {
			analysisId: 1,
			index: {
				id: 1,
				path: sourcePath,
				storageKey: "indexes/1/source",
			},
			pScoreCutoff: 0.01,
			reads: [],
			subtractions: [],
		};
		const state: PathoscopeState = {
			candidateOtuIds: ["otu_1"],
			subtractedCount: 0,
		};

		await buildCandidateOtuIndexStep.run(
			createFakeContext(data, state, { runSubprocess, workPath }),
		);

		await expect(readFile(paths.candidateOtuFasta, "utf8")).resolves.toBe(
			">seq_survivor\nACGTACGTACGT\n",
		);
		expect(commands[0]).toEqual([
			"bowtie2-build",
			"--threads",
			"2",
			paths.candidateOtuFasta,
			paths.candidateOtuIndexPrefix,
		]);
	});
});
