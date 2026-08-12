/**
 * Driving `seqkit fx2tab` for a genome's nucleotide composition.
 *
 * Python's `compute_gc_and_count`, kept deliberately close to it: the same
 * subcommand with the same flags, the same per-record accumulation in a stdout
 * handler, and the same arithmetic afterwards. seqkit reads gzip natively, so
 * the compressed upload is counted where it lies and no plain FASTA is ever
 * written.
 *
 * The command builder and the accumulator are separate from the step so both
 * are testable without spawning anything — the command line is asserted
 * directly, and the arithmetic is driven with the lines seqkit would have
 * produced.
 */

import { roundHalfEven } from "@virtool/bio";
import type { NucleotideComposition } from "@virtool/contracts";

/** The nucleotides counted, and the keys `gc` is reported under. */
const NUCLEOTIDES = ["a", "t", "g", "c", "n"] as const;

type Nucleotide = (typeof NUCLEOTIDES)[number];

/** Places `gc` is rounded to, matching Python's `round(ratio, 3)`. */
const GC_PLACES = 3;

/** What one pass over a genome yields. */
export type GenomeComposition = {
	/** Sequences seen, one per record seqkit reported. */
	count: number;

	/** Each nucleotide's share of the five counted, rounded to three places. */
	gc: NucleotideComposition;
};

/**
 * The command Python runs, argument for argument.
 *
 * `--name --only-id` reduces the first column to the sequence id, which nothing
 * reads — the columns that matter are the five `--base-count`s that follow, in
 * this order. Changing the order here silently relabels them.
 */
export function buildSeqkitCommand(path: string, proc: number): string[] {
	return [
		"seqkit",
		"fx2tab",
		"--name",
		"--only-id",
		"--threads",
		String(proc),
		...NUCLEOTIDES.flatMap((nucleotide) => ["--base-count", nucleotide]),
		path,
	];
}

/** Accumulates `fx2tab` output, one record at a time. */
export type BaseCountAccumulator = {
	/** Adds one record's counts to the running totals. */
	handleLine: (line: string) => void;

	/**
	 * The composition, once every record has been handled.
	 *
	 * @throws {Error} when the file held no sequences, or held sequences but
	 *   none of the five nucleotides. Python raises separately for each, in this
	 *   order, rather than dividing by zero.
	 */
	result: () => GenomeComposition;
};

/**
 * Tally `fx2tab` records as they arrive.
 *
 * Accumulated per line rather than collected and summed at the end, so memory
 * does not scale with the number of sequences — a fragmented assembly has
 * hundreds of thousands of them.
 */
export function createBaseCountAccumulator(): BaseCountAccumulator {
	const tally: Record<Nucleotide, number> = { a: 0, t: 0, g: 0, c: 0, n: 0 };

	let count = 0;

	return {
		handleLine(line) {
			// seqkit emits a trailing newline of its own; the line reader strips
			// the separator but an empty final line still reaches here.
			if (line === "") {
				return;
			}

			const fields = line.split("\t");

			// One id column plus the five counts. A short line means the flags and
			// this parser disagree, which would otherwise surface as a plausible
			// composition computed from `NaN`.
			if (fields.length !== NUCLEOTIDES.length + 1) {
				throw new Error(
					`Expected ${NUCLEOTIDES.length + 1} columns from seqkit fx2tab, got ${fields.length}: ${JSON.stringify(line)}`,
				);
			}

			NUCLEOTIDES.forEach((nucleotide, index) => {
				const raw = fields[index + 1] ?? "";

				if (!/^\d+$/.test(raw)) {
					throw new Error(
						`seqkit fx2tab reported a non-numeric ${nucleotide} count: ${JSON.stringify(raw)}`,
					);
				}

				tally[nucleotide] += Number(raw);
			});

			count += 1;
		},

		result() {
			if (count === 0) {
				throw new Error("No sequences found in subtraction FASTA");
			}

			// **The denominator is the five counters' sum, not the sequence
			// length.** An IUPAC ambiguity code is counted by neither side, so the
			// five shares still total one. Dividing by length reports every share
			// low by the same factor, which looks plausible and matches nothing.
			const total = NUCLEOTIDES.reduce(
				(sum, nucleotide) => sum + tally[nucleotide],
				0,
			);

			if (total === 0) {
				throw new Error("No A, T, G, C, or N bases found in subtraction FASTA");
			}

			// Half-to-even, which is Python's `round`. `Math.round` is half-up, so
			// the two disagree on a ratio landing exactly on a half at the third
			// place.
			return {
				count,
				gc: {
					a: roundHalfEven(tally.a / total, GC_PLACES),
					t: roundHalfEven(tally.t / total, GC_PLACES),
					g: roundHalfEven(tally.g / total, GC_PLACES),
					c: roundHalfEven(tally.c / total, GC_PLACES),
					n: roundHalfEven(tally.n / total, GC_PLACES),
				},
			};
		},
	};
}
