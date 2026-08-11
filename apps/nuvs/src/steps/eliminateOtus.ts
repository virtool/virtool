import { trimmedReadPaths, workPaths } from "../paths";
import type { NuvsStep } from "./types";

/**
 * Map the trimmed reads against the reference and keep only what missed.
 *
 * NuVs looks for viruses the reference does *not* know about, so a read that
 * aligns to a known OTU is not evidence of anything novel and is dropped here.
 * `--un` is what carries the rest forward; the SAM stream bowtie2 writes to
 * stdout is never read, and the runtime opens it on `/dev/null` for exactly that
 * reason.
 *
 * **Both halves of a pair go in through `-U`**, as unpaired reads. Pairing is
 * restored later, by `reunite_pairs`, from the headers that survive this and the
 * subtraction pass — aligning them as pairs here would let one mate's alignment
 * discard the other.
 */
export const eliminateOtusStep: NuvsStep = {
	id: "eliminate_otus",
	name: "Eliminate OTUs",
	description: "Map sample reads to reference OTUs and discard.",
	async run({ data, proc, runSubprocess, workPath }) {
		const paths = workPaths(workPath);

		await runSubprocess({
			command: [
				"bowtie2",
				"-p",
				String(proc),
				"-k",
				"1",
				"--very-fast-local",
				"-x",
				paths.referenceIndexPrefix,
				"--un",
				paths.unmappedOtus,
				// `-U` accumulates every path that follows it, verified against
				// bowtie2 2.5.4 — the manual's "comma-separated list" wording makes
				// the multi-argument form read like a bug.
				"-U",
				...trimmedReadPaths(paths, data.sample.paired),
			],
		});
	},
};
