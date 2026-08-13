import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { buildQualityCommand, readQuality, reduceQuality } from "../quality";
import type { CreateSampleStep } from "./types";

/**
 * Measure the quality of the uploaded reads.
 *
 * `quality-core` reads gzip natively, so this runs against the uploads as they
 * lie and the run never writes a decompressed FASTQ.
 *
 * Each read gets its own invocation and its own results file, which is what
 * makes a blob's read unambiguous — see `quality.ts`. They run in sequence
 * rather than concurrently: the crate holds one cycle histogram per position
 * and nothing else, so the memory argument FastQC forced is gone, but there is
 * no throughput to win either. Both invocations are bound by reading the file.
 *
 * Python guards nothing here; its runner treats termination by SIGTERM as
 * success, so a FastQC killed part way through leaves a truncated report that
 * parses. This runtime throws `SubprocessFailedError` on any non-zero exit,
 * code 15 included. The one outcome that resolves is a cancellation-driven
 * kill, and that is what the check below is for.
 */
export const runFastqcStep: CreateSampleStep = {
	/* Python's function name, and the jobs API stores it — a rename changes the
	 * shape of a job's step list at cutover. It outlives the tool it was named
	 * after; the display name below is the part free to say what now runs. */
	id: "run_fastqc",
	name: "Measure quality",
	description: "Measure the quality of the read files.",
	async run({ data, logger, runSubprocess, state }) {
		const reports = [];

		for (const read of data.paths.reads) {
			// The crate creates its results file but not the directory holding it.
			await mkdir(dirname(read.qualityOutput), { recursive: true });

			const { cancelled } = await runSubprocess({
				command: buildQualityCommand(read.upload, read.qualityOutput),
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

			reports.push(await readQuality(read.qualityOutput));
		}

		const quality = reduceQuality(reports);

		state.quality = quality;

		logger.info(
			{ count: quality.count, gc: quality.gc, length: quality.length },
			"measured quality",
		);
	},
};
