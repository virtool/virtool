import { mkdir } from "node:fs/promises";
import { buildFastqcCommand, readFastqcReport, reduceQuality } from "../fastqc";
import type { CreateSampleStep } from "./types";

/**
 * Run `fastqc` over the uploaded reads and parse the report.
 *
 * FastQC reads gzip natively, so this runs against the uploads as they lie and
 * the run never writes a decompressed FASTQ.
 *
 * Each read gets its own invocation and its own output directory, which is what
 * makes a report's read unambiguous — see `fastqc.ts`. They run in sequence
 * rather than concurrently: FastQC holds roughly 250 MB per file in flight and
 * a workflow pod's memory limit is sized for one, so two at once is the way a
 * paired run gets OOM-killed.
 *
 * Python guards nothing here; its runner treats termination by SIGTERM as
 * success, so a FastQC killed part way through leaves a truncated report that
 * parses. This runtime throws `SubprocessFailedError` on any non-zero exit,
 * code 15 included. The one outcome that resolves is a cancellation-driven
 * kill, and that is what the check below is for.
 */
export const runFastqcStep: CreateSampleStep = {
	id: "run_fastqc",
	// Python's `@step(name="Run FastQC")`. Without it the title-cased default
	// renders as "Run Fastqc", which is a different label in the job's step list.
	name: "Run FastQC",
	description: "Run FastQC on the read files and parse the quality data.",
	async run({ data, logger, runSubprocess, state }) {
		const reports = [];

		for (const read of data.paths.reads) {
			// FastQC refuses to start when `-o` names a directory that is not
			// already there.
			await mkdir(read.fastqcOutput, { recursive: true });

			const { cancelled } = await runSubprocess({
				command: buildFastqcCommand(read.upload, read.fastqcOutput),
			});

			/* The run is being torn down and this process was killed, so whatever
			 * is on disk covers part of a read file at best.
			 *
			 * Returning here cannot leave `finalize` to fail on a null quality:
			 * `cancelled` is only ever true with the run's signal already
			 * aborted, so the run loop breaks before the next step rather than
			 * carrying on. Nor is it silent — the subprocess runner has already
			 * logged the SIGTERM, and the loop logs the cancellation. */
			if (cancelled) {
				return;
			}

			reports.push(await readFastqcReport(read.fastqcOutput));
		}

		const quality = reduceQuality(reports);

		state.quality = quality;

		logger.info(
			{ count: quality.count, gc: quality.gc, length: quality.length },
			"parsed quality data",
		);
	},
};
