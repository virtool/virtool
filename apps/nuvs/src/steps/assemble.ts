import { compressFile } from "@virtool/archive/compression";
import { workPaths } from "../paths";
import type { NuvsStep } from "./types";

/**
 * The k-mer lengths SPAdes is run with, for an ordinary library.
 *
 * A field in nothing cached, so unlike the skewer settings these are free to
 * change — but they decide the assembly, so a change makes every analysis run
 * before it incomparable with one run after.
 */
export const DEFAULT_KMER_LENGTHS = "21,33,55,75";

/**
 * The k-mer lengths for an sRNA library.
 *
 * Small RNA reads are 20–24 nt, so the default set is longer than the reads
 * themselves and SPAdes would assemble nothing at all.
 */
export const SRNA_KMER_LENGTHS = "17,21,23";

/** The k-mer lengths a sample's library type calls for. */
export function kmerLengthsFor(libraryType: string): string {
	return libraryType === "srna" ? SRNA_KMER_LENGTHS : DEFAULT_KMER_LENGTHS;
}

/**
 * Assemble the surviving reads into contigs with SPAdes.
 *
 * A paired run assembles the two files `reunite_pairs` rebuilt; a single-end run
 * assembles what came out of the subtraction pass directly, since there were
 * never pairs to restore.
 *
 * SPAdes narrates its progress on stdout at length. It is logged line by line
 * rather than dropped, because it is the only account of an assembly that ran for
 * an hour and produced nothing — and passing a handler is also what makes the
 * runtime pipe stdout at all.
 */
export const assembleStep: NuvsStep = {
	id: "assemble",
	description: "Assemble reads using SPAdes.",
	async run({ data, logger, mem, proc, runSubprocess, workPath }) {
		const paths = workPaths(workPath);
		const spadesLogger = logger.child({ tool: "spades" });

		const kmerLengths = kmerLengthsFor(data.sample.libraryType);

		const inputs = data.sample.paired
			? ["-1", paths.unmappedPair(1), "-2", paths.unmappedPair(2)]
			: ["-s", paths.unmappedSubtractions];

		await runSubprocess({
			command: [
				"spades.py",
				"-t",
				String(proc),
				"-m",
				String(mem),
				"-k",
				kmerLengths,
				"-o",
				paths.spadesDir,
				...inputs,
			],
			stdout: (line) => {
				spadesLogger.info({ line }, "stdout");
			},
		});

		await compressFile(paths.spadesScaffolds, paths.compressedAssembly);

		logger.info(
			{ assemblyPath: paths.compressedAssembly, kmerLengths },
			"compressed assembly",
		);
	},
};
