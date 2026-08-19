import { buildSeqkitCommand, createBaseCountAccumulator } from "../seqkit";
import type { CreateSubtractionStep } from "./types";

/**
 * Count the genome's sequences and nucleotides with `seqkit fx2tab`.
 *
 * seqkit reads gzip natively, so this runs against the upload as it lies and
 * the run never writes a decompressed genome.
 *
 * This call needs no explicit return-code guard: a non-zero exit throws
 * `SubprocessFailedError`, exit code 15 included, so a seqkit killed part way
 * through cannot leave the composition computed from a fraction of the
 * sequences. The one outcome that resolves is a cancellation-driven kill, and
 * that is what the check below is for.
 */
export const computeGcAndCountStep: CreateSubtractionStep = {
	id: "compute_gc_and_count",
	// Title-casing the id gives `Compute Gc And Count`, so the label is spelled
	// out here instead.
	name: "Compute GC and Count",
	description:
		"Compute the genome's nucleotide composition and sequence count.",
	async run({ data, logger, proc, runSubprocess, state }) {
		const accumulator = createBaseCountAccumulator();

		const { cancelled } = await runSubprocess({
			command: buildSeqkitCommand(data.paths.upload, proc),
			stdout: accumulator.handleLine,
		});

		// The run is being torn down and this process was killed, so the totals
		// cover only the records that arrived first. Writing them would hand
		// `finalize` a composition for part of a genome.
		if (cancelled) {
			return;
		}

		const { count, gc } = accumulator.result();

		state.count = count;
		state.gc = gc;

		logger.info({ count, gc }, "computed nucleotide composition");
	},
};
