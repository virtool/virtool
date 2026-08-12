import {
	createFakeContext,
	createFakeSubprocessRunner,
} from "@virtool/workflow/testing";
import { describe, expect, it } from "vitest";
import type { CreateSubtractionData } from "../context";
import { workPaths } from "../paths";
import { computeGcAndCountStep } from "./computeGcAndCount";

const SUBTRACTION_ID = 44;

const WORK_PATH = "/work";

const PATHS = workPaths(WORK_PATH, SUBTRACTION_ID);

/** Python's mixed-case fixture, as seqkit reports it. */
const RECORDS = ["seq_1\t2\t2\t2\t2\t2", "seq_2\t3\t3\t2\t2\t0"];

function setup(stdout: string[] = RECORDS, cancelled = false) {
	const runSubprocess = createFakeSubprocessRunner({ stdout, cancelled });

	const data: CreateSubtractionData = {
		subtractionId: SUBTRACTION_ID,
		subtractionName: "Arabidopsis",
		uploadStorageKey: "uploads/whatever",
		uploadIsGzipped: true,
		paths: PATHS,
	};

	const context = createFakeContext(
		data,
		{ count: null, gc: null },
		{ proc: 4, runSubprocess, workPath: WORK_PATH },
	);

	return { context, runSubprocess };
}

describe("computeGcAndCountStep", () => {
	it("runs seqkit against the upload as it lies", async () => {
		const { context, runSubprocess } = setup();

		await computeGcAndCountStep.run(context);

		// The gzipped upload, not a decompressed copy: seqkit reads gzip natively
		// and this workflow writes no plain FASTA.
		expect(runSubprocess.commands()).toEqual([
			[
				"seqkit",
				"fx2tab",
				"--name",
				"--only-id",
				"--threads",
				"4",
				"--base-count",
				"a",
				"--base-count",
				"t",
				"--base-count",
				"g",
				"--base-count",
				"c",
				"--base-count",
				"n",
				PATHS.upload,
			],
		]);
	});

	it("records the composition seqkit reported", async () => {
		const { context } = setup();

		await computeGcAndCountStep.run(context);

		expect(context.state.count).toBe(2);
		expect(context.state.gc).toEqual({
			a: 0.25,
			t: 0.25,
			g: 0.2,
			c: 0.2,
			n: 0.1,
		});
	});

	// A cancelled seqkit was killed part way through, so its totals cover only
	// the records that arrived first. This is the case Python guards with an
	// explicit return-code check.
	it("records nothing when the run was cancelled", async () => {
		const { context } = setup(RECORDS, true);

		await computeGcAndCountStep.run(context);

		expect(context.state.count).toBeNull();
		expect(context.state.gc).toBeNull();
	});

	it("fails when seqkit reported no sequences", async () => {
		const { context } = setup([]);

		await expect(computeGcAndCountStep.run(context)).rejects.toThrow(
			"No sequences found in subtraction FASTA",
		);
	});
});
