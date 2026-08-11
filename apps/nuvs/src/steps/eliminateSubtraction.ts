import { rename } from "node:fs/promises";
import { workPaths } from "../paths";
import type { NuvsStep } from "./types";

/**
 * Map what survived the reference against each subtraction and keep only what
 * missed again.
 *
 * A read that aligns to the host genome is the host's, not a novel virus, so it
 * goes the same way a reference hit did. With several subtractions the passes
 * are a chain: each one filters what the last left, so a read has to miss *every*
 * subtraction to reach the assembler.
 *
 * **The carry between passes is a rename, not a copy.** Python copies
 * `unmapped_subtractions.fq` back over `working_otus.fq` after every pass, which
 * is a full copy of a multi-gigabyte FASTQ per subtraction on a disk sized for
 * one. Nothing reads either path between passes, so moving is equivalent — and
 * `unmapped_otus.fq` is moved in for the same reason, since no later step opens
 * it.
 */
export const eliminateSubtractionStep: NuvsStep = {
	id: "eliminate_subtraction",
	description: "Map remaining reads to the subtraction and discard.",
	async run({ data, logger, proc, runSubprocess, workPath }) {
		const paths = workPaths(workPath);

		if (data.subtractions.length === 0) {
			await rename(paths.unmappedOtus, paths.unmappedSubtractions);

			logger.info("no subtractions; carrying every unmapped read forward");

			return;
		}

		await rename(paths.unmappedOtus, paths.workingOtus);

		for (const subtraction of data.subtractions) {
			await runSubprocess({
				command: [
					"bowtie2",
					"--very-fast-local",
					"-k",
					"1",
					"-p",
					String(proc),
					"-x",
					// Python wraps this in `shlex.quote`, which is a no-op for every
					// path it is ever given and would be wrong if it were not: the
					// command is an argument array, never a shell string, so a quoted
					// path would reach bowtie2 with its quotes attached.
					paths.subtraction(subtraction.id).indexPrefix,
					"--un",
					paths.unmappedSubtractions,
					"-U",
					paths.workingOtus,
				],
			});

			await rename(paths.unmappedSubtractions, paths.workingOtus);

			logger.info(
				{ subtractionId: subtraction.id },
				"eliminated reads mapping to subtraction",
			);
		}

		await rename(paths.workingOtus, paths.unmappedSubtractions);
	},
};
