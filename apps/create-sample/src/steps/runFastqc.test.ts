import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Quality } from "@virtool/contracts";
import {
	createFakeContext,
	createFakeSubprocessRunner,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { CreateSampleData } from "../context";
import { workPaths } from "../paths";
import { createCreateSampleState } from "../state";
import { runFastqcStep } from "./runFastqc";

const SAMPLE_ID = 91;

/** A blob shaped like one `quality-core` writes, distinguishable per read. */
function createQuality(count: number): Quality {
	return {
		bases: [[36, 37, 35, 38, 33, 39]],
		composition: [[25.1, 24.9, 25, 25]],
		count,
		encoding: "Sanger / Illumina 1.9",
		gc: 41,
		length: [75, 75],
		sequences: Array.from({ length: 50 }, (_, score) =>
			score === 36 ? count : 0,
		),
	};
}

/**
 * A run whose `quality-core` is a fake.
 *
 * The fake spawns nothing, so `writeResults` stands in for the tool: it lays
 * a blob down where the crate would have, and the step reads it back.
 */
async function setup(uploadNames: readonly string[]) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const paths = workPaths(workPath, uploadNames);
	const runSubprocess = createFakeSubprocessRunner();

	runSubprocess.register((command) => command[0] === "quality-core", {
		exitCode: 0,
	});

	async function writeResults(): Promise<void> {
		for (const [index, read] of paths.reads.entries()) {
			await mkdir(dirname(read.qualityOutput), { recursive: true });
			await writeFile(
				read.qualityOutput,
				JSON.stringify(createQuality(20000 + index)),
			);
		}
	}

	const data: CreateSampleData = {
		sampleId: SAMPLE_ID,
		sampleName: "Test",
		uploadStorageKeys: uploadNames.map((_, index) => `uploads/${index}`),
		uploadsAreGzipped: uploadNames.map(() => true),
		paths,
	};

	const context = createFakeContext(data, createCreateSampleState(), {
		runSubprocess,
		workPath,
	});

	return { context, paths, runSubprocess, workPath, writeResults };
}

describe("runFastqcStep", () => {
	/**
	 * The step id outlives the tool it was named after: the jobs API stores it,
	 * so it stays `run_fastqc` even though nothing here runs FastQC.
	 */
	it("keeps the step id Python wrote", () => {
		expect(runFastqcStep.id).toBe("run_fastqc");
	});

	it("runs one invocation per read, each into its own results file", async () => {
		const { context, paths, runSubprocess, writeResults } = await setup([
			"left.fq.gz",
			"right.fq.gz",
		]);

		await writeResults();

		await runFastqcStep.run(context);

		const commands = runSubprocess.calls().map((call) => call.command);

		expect(commands).toStrictEqual([
			[
				"quality-core",
				"--input",
				paths.reads[0]?.upload,
				"--output",
				paths.reads[0]?.qualityOutput,
			],
			[
				"quality-core",
				"--input",
				paths.reads[1]?.upload,
				"--output",
				paths.reads[1]?.qualityOutput,
			],
		]);
	});

	/** The crate creates its results file, but not the directory holding it. */
	it("creates the directory the results file goes in", async () => {
		const { context, paths, writeResults } = await setup(["only.fq.gz"]);

		await writeResults();
		await runFastqcStep.run(context);

		expect(context.state.quality).not.toBeNull();
		expect(paths.reads[0]?.qualityOutput).toContain("quality");
	});

	it("stores a single read's blob as it stands", async () => {
		const { context, writeResults } = await setup(["only.fq.gz"]);

		await writeResults();
		await runFastqcStep.run(context);

		expect(context.state.quality?.count).toBe(20000);
		expect(context.state.quality?.gc).toBe(41);
	});

	it("composites a paired sample's two blobs", async () => {
		const { context, writeResults } = await setup([
			"left.fq.gz",
			"right.fq.gz",
		]);

		await writeResults();
		await runFastqcStep.run(context);

		// The sum of both mates, which profiled 20000 and 20001 reads.
		expect(context.state.quality?.count).toBe(40001);
	});

	/**
	 * A cancellation-driven kill is the one non-zero outcome that resolves. What
	 * is on disk covers part of a read file at best, so nothing is recorded.
	 */
	it("records nothing when the run was cancelled", async () => {
		const { context, runSubprocess, writeResults } = await setup([
			"only.fq.gz",
		]);

		await writeResults();

		runSubprocess.register((command) => command[0] === "quality-core", {
			cancelled: true,
		});

		await runFastqcStep.run(context);

		expect(context.state.quality).toBeNull();
	});

	it("propagates a quality-core failure", async () => {
		const { context, runSubprocess } = await setup(["only.fq.gz"]);

		runSubprocess.register((command) => command[0] === "quality-core", {
			exitCode: 1,
			stderr: ["quality-core: FASTQ error: unexpected end of input"],
		});

		await expect(runFastqcStep.run(context)).rejects.toThrow(
			"unexpected end of input",
		);
	});
});
