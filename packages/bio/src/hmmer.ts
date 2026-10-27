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

const TARGET_PATTERN = /^vFam_(\d+)$/;

const QUERY_PATTERN = /^sequence_(\d+)\.(\d+)$/;

/** Matches a decimal number with an optional exponent, and nothing more. */
const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseIndex(raw: string | undefined, token: string): number {
	const parsed = Number(raw);

	if (!Number.isSafeInteger(parsed)) {
		throw new Error(
			`Malformed hmmscan --tblout name: index out of range in ${token}`,
		);
	}

	return parsed;
}

function parseValue(raw: string | undefined, name: string): number {
	const parsed =
		raw !== undefined && NUMBER_PATTERN.test(raw) ? Number(raw) : Number.NaN;

	if (!Number.isFinite(parsed)) {
		throw new Error(
			`Malformed hmmscan --tblout ${name}: expected a finite number, got ${raw}`,
		);
	}

	return parsed;
}

function parseEValue(raw: string | undefined, name: string): number {
	const parsed = parseValue(raw, name);

	// Check the raw sign: `-1e-999` parses to `-0`, which is not less than zero.
	if (raw?.startsWith("-")) {
		throw new Error(
			`Malformed hmmscan --tblout ${name}: expected a non-negative number, got ${raw}`,
		);
	}

	return parsed;
}

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

		// A row this parse reads runs to field 9, so a short row is malformed and
		// fails loudly here: parsing on would put NaN into a hit and carry it into
		// the stored analysis document, where it is far harder to trace back to a
		// truncated table.
		if (fields.length < 10) {
			throw new Error(
				`Malformed hmmscan --tblout row: expected at least 10 fields, got ${fields.length}`,
			);
		}

		const target = fields[0] ?? "";
		const query = fields[2] ?? "";

		// The target name is formatted `vFam_<cluster>` and the query name
		// `sequence_<contig>.<orf>`. Those two names are the *only* thing carrying
		// a hit back to the ORF it belongs to, so the whole token must match:
		// `Number.parseInt` would read `sequence_1x.2` as contig 1 and silently
		// address the wrong ORF.
		const clusterMatch = TARGET_PATTERN.exec(target);

		if (clusterMatch === null) {
			throw new Error(
				`Malformed hmmscan --tblout target name: expected vFam_<cluster>, got ${target}`,
			);
		}

		const queryMatch = QUERY_PATTERN.exec(query);

		if (queryMatch === null) {
			throw new Error(
				`Malformed hmmscan --tblout query name: expected sequence_<contig>.<orf>, got ${query}`,
			);
		}

		const cluster = parseIndex(clusterMatch[1], target);
		const sequenceIndex = parseIndex(queryMatch[1], query);
		const orfIndex = parseIndex(queryMatch[2], query);

		hits.push({
			// SWAPPED ON PURPOSE. `best_bias` is read from column 8, which hmmscan
			// documents as the best-domain *score*, and `best_score` from column 9,
			// the best-domain *bias*. These values are stored under these names in
			// every analysis `results` blob already written and are pinned by
			// `NuvsOrfHit` in `@virtool/contracts`. Unswapping them here alone would
			// silently disagree with every record written so far; it means a
			// coordinated change to the stored blobs and the UI.
			best_bias: parseValue(fields[8], "best-domain score"),
			best_e: parseEValue(fields[7], "best-domain E-value"),
			best_score: parseValue(fields[9], "best-domain bias"),
			cluster,
			full_bias: parseValue(fields[6], "full-sequence bias"),
			full_e: parseEValue(fields[4], "full-sequence E-value"),
			full_score: parseValue(fields[5], "full-sequence score"),
			orfIndex,
			sequenceIndex,
		});
	}

	return hits;
}
