import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
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

function fixturePath(mate: 1 | 2): string {
	return join(
		import.meta.dirname,
		"..",
		"fixtures",
		`paired_${mate}.fastqc_data.txt`,
	);
}

/**
 * A run whose FastQC is a fake that lays down a real report.
 *
 * The fake writes the fixture where the tool would have, so the step's own
 * search and parse run against genuine FastQC 0.11.9 output.
 */
async function setup(uploadNames: readonly string[]) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const paths = workPaths(workPath, uploadNames);
	const runSubprocess = createFakeSubprocessRunner();

	// The step creates the output directory before spawning, so by the time this
	// runs the target is there. Mate is taken from the output directory's own
	// name, which is the read's position.
	runSubprocess.register((command) => command[0] === "fastqc", { exitCode: 0 });

	async function writeReports(): Promise<void> {
		for (const [index, read] of paths.reads.entries()) {
			const reportPath = join(read.fastqcOutput, "upload_fastqc");

			await mkdir(reportPath, { recursive: true });
			await copyFile(
				fixturePath(index === 0 ? 1 : 2),
				join(reportPath, "fastqc_data.txt"),
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

	return { context, paths, runSubprocess, workPath, writeReports };
}

describe("runFastqcStep", () => {
	it("runs one fastqc per read, each into its own output directory", async () => {
		const { context, paths, runSubprocess, writeReports } = await setup([
			"left.fq.gz",
			"right.fq.gz",
		]);

		// Stand in for the tool: the fake spawns nothing, so the reports have to
		// be on disk before the step reads them.
		await writeReports();

		await runFastqcStep.run(context);

		const commands = runSubprocess.calls().map((call) => call.command);

		expect(commands).toStrictEqual([
			[
				"fastqc",
				"-f",
				"fastq",
				"-o",
				paths.reads[0]?.fastqcOutput,
				"--extract",
				paths.reads[0]?.upload,
			],
			[
				"fastqc",
				"-f",
				"fastq",
				"-o",
				paths.reads[1]?.fastqcOutput,
				"--extract",
				paths.reads[1]?.upload,
			],
		]);
	});

	it("creates each output directory, which fastqc will not do", async () => {
		const { context, paths, writeReports } = await setup(["only.fq.gz"]);

		await writeReports();
		await runFastqcStep.run(context);

		await expect(
			readdir(paths.reads[0]?.fastqcOutput ?? ""),
		).resolves.not.toHaveLength(0);
	});

	it("stores a single read's report as it stands", async () => {
		const { context, writeReports } = await setup(["only.fq.gz"]);

		await writeReports();
		await runFastqcStep.run(context);

		expect(context.state.quality?.count).toBe(20000);
		expect(context.state.quality?.gc).toBe(41);
	});

	it("composites a paired sample's two reports", async () => {
		const { context, writeReports } = await setup([
			"left.fq.gz",
			"right.fq.gz",
		]);

		await writeReports();
		await runFastqcStep.run(context);

		// The sum of both mates, each of which parsed 20000 reads.
		expect(context.state.quality?.count).toBe(40000);
	});

	/**
	 * A cancellation-driven kill is the one non-zero outcome that resolves. What
	 * is on disk covers part of a read file at best, so nothing is recorded.
	 */
	it("records nothing when the run was cancelled", async () => {
		const { context, runSubprocess, writeReports } = await setup([
			"only.fq.gz",
		]);

		await writeReports();

		runSubprocess.register((command) => command[0] === "fastqc", {
			cancelled: true,
		});

		await runFastqcStep.run(context);

		expect(context.state.quality).toBeNull();
	});

	it("propagates a fastqc failure", async () => {
		const { context, runSubprocess } = await setup(["only.fq.gz"]);

		runSubprocess.register((command) => command[0] === "fastqc", {
			exitCode: 1,
			stderr: ["Failed to process file only.fq.gz"],
		});

		await expect(runFastqcStep.run(context)).rejects.toThrow(
			"Failed to process file",
		);
	});
});
