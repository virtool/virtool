import { createWriteStream } from "node:fs";
import { rename } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { findOrfs, parseFastaLines } from "@virtool/bio";
import { compressFile } from "@virtool/workflow";
import { workPaths } from "../paths";
import { readLines } from "../sequences";
import type { NuvsRawContig } from "../state";
import type { NuvsStep } from "./types";

/**
 * The shortest contig worth considering.
 *
 * `findOrfs` only reports ORFs of 100 residues or more, which needs 300 bases
 * before a start and a stop, so this is very nearly the same filter twice over —
 * it is Python's and is kept because *very nearly* is not the same as exactly: a
 * 300-base contig passes here and yields nothing there.
 */
const MINIMUM_CONTIG_LENGTH = 300;

/**
 * Find the open reading frames in the assembled contigs.
 *
 * Two filters, in order: a contig shorter than {@link MINIMUM_CONTIG_LENGTH} is
 * dropped, and so is one in which no ORF was found. What survives is the whole
 * of the analysis's `results` blob, and its `index` is the id every later
 * reference — a BLAST request, the UI's routing — addresses it by. That makes the
 * numbering positional: it counts the contigs that *survived*, not the ones the
 * assembler produced.
 *
 * `nuc` is dropped from every ORF. It is the nucleotide slice the translation
 * came from, recoverable from the contig's own `sequence` and the ORF's `pos`,
 * and keeping it would roughly double a blob that is already the largest thing a
 * NuVs analysis stores.
 */
export const processAssemblyStep: NuvsStep = {
	id: "process_assembly",
	description: "Find ORFs in the assembled contigs.",
	async run({ logger, state, workPath }) {
		const paths = workPaths(workPath);

		// `assemble` has already compressed the scaffolds under their original
		// name, so this rename is what gives the uncompressed copy a name only this
		// step reads. Python does the same, in the same order.
		await rename(paths.spadesScaffolds, paths.assemblyFasta);

		const contigs: NuvsRawContig[] = [];

		for await (const [, sequence] of parseFastaLines(
			readLines(paths.assemblyFasta),
		)) {
			if (sequence.length < MINIMUM_CONTIG_LENGTH) {
				continue;
			}

			const orfs = findOrfs(sequence);

			if (orfs.length === 0) {
				continue;
			}

			contigs.push({
				index: contigs.length,
				orfs: orfs.map(({ nuc: _nuc, ...orf }, index) => ({
					...orf,
					hits: [],
					index,
				})),
				sequence,
			});
		}

		await writeOrfsFasta(paths.orfsFasta, contigs);

		await compressFile(paths.orfsFasta, paths.compressedOrfs);

		state.hits = contigs;

		logger.info(
			{
				contigCount: contigs.length,
				orfCount: contigs.reduce(
					(total, contig) => total + contig.orfs.length,
					0,
				),
			},
			"found open reading frames",
		);
	},
};

/**
 * Write the ORF translations `hmmscan` will search.
 *
 * The header is `sequence_{contig}.{orf}`, and it is the **only** thing carrying
 * those two indexes into HMMER's output — `parseHmmerTblout` reads them straight
 * back out of the target name. Changing this format silently unmoors every hit
 * from the ORF it belongs to.
 */
async function writeOrfsFasta(
	path: string,
	contigs: readonly NuvsRawContig[],
): Promise<void> {
	await pipeline(
		(function* () {
			for (const contig of contigs) {
				for (const orf of contig.orfs) {
					yield `>sequence_${contig.index}.${orf.index}\n${orf.pro}\n`;
				}
			}
		})(),
		createWriteStream(path),
	);
}
