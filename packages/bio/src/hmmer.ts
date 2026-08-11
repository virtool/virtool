/** One `hmmscan --tblout` row, addressed by contig and ORF index. */
export type HmmerHit = {
	best_bias: number;
	best_e: number;
	best_score: number;

	/** The vFam cluster id, parsed from the target name */
	cluster: number;

	full_bias: number;
	full_e: number;
	full_score: number;

	/** The index of the ORF within its contig */
	orfIndex: number;

	/** The index of the contig the ORF was found in */
	sequenceIndex: number;
};

/**
 * Parse `hmmscan --tblout` rows, keeping vFam hits in file order.
 *
 * Only lines beginning with `vFam` are considered. That prefix test is the
 * only filter — it is what skips every `#` comment line hmmscan writes.
 *
 * Joining each hit's cluster to its HMM annotation and merging the result into
 * the analysis document stays in the workflow; both need the database.
 */
export function parseHmmerTblout(lines: Iterable<string>): HmmerHit[] {
	const hits: HmmerHit[] = [];

	for (const line of lines) {
		if (!line.startsWith("vFam")) {
			continue;
		}

		const fields = line.trim().split(/\s+/);

		// Python indexes up to field 9 and raises IndexError on a short row.
		// Failing here keeps that loud: parsing on would put NaN into a hit and
		// carry it into the stored analysis document, where it is far harder to
		// trace back to a truncated table.
		if (fields.length < 10) {
			throw new Error(
				`Malformed hmmscan --tblout row: expected at least 10 fields, got ${fields.length}`,
			);
		}

		// The guard above proves indices 0 through 9 are present. Re-testing each
		// would be nine dead branches, and an empty string parses to the same NaN
		// an absent one would.
		const field = (index: number): string => fields[index] ?? "";

		// The target name is formatted `vFam_<cluster>` and the query name
		// `sequence_<contig>.<orf>`. Those two names are the *only* thing carrying
		// a hit back to the ORF it belongs to, so a name that does not fit fails
		// here for the same reason a short row does: the alternative is a NaN index
		// silently addressing the wrong ORF, or none.
		const rawCluster = field(0).split("_")[1];

		if (rawCluster === undefined) {
			throw new Error(
				`Malformed hmmscan --tblout target name: expected vFam_<cluster>, got ${field(0)}`,
			);
		}

		const cluster = Number.parseInt(rawCluster, 10);

		const [rawSequenceIndex, rawOrfIndex] =
			field(2).split("_")[1]?.split(".") ?? [];

		if (rawSequenceIndex === undefined || rawOrfIndex === undefined) {
			throw new Error(
				`Malformed hmmscan --tblout query name: expected sequence_<contig>.<orf>, got ${field(2)}`,
			);
		}

		const sequenceIndex = Number.parseInt(rawSequenceIndex, 10);
		const orfIndex = Number.parseInt(rawOrfIndex, 10);

		hits.push({
			// `best_bias` and `best_score` are read from the columns hmmscan
			// documents as the best-domain score and bias respectively — they are
			// swapped relative to the file format. This reproduces a bug in the
			// Python workflow on purpose: these values are stored under these names
			// in every analysis `results` blob and are already pinned by
			// `NuvsOrfHit` in `@virtool/contracts`. Correcting it here alone would
			// silently disagree with every record written so far. Fixing it means a
			// coordinated change to Python, the stored blobs, and the UI.
			best_bias: Number.parseFloat(field(8)),
			best_e: Number.parseFloat(field(7)),
			best_score: Number.parseFloat(field(9)),
			cluster,
			full_bias: Number.parseFloat(field(6)),
			full_e: Number.parseFloat(field(4)),
			full_score: Number.parseFloat(field(5)),
			orfIndex,
			sequenceIndex,
		});
	}

	return hits;
}
