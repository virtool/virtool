/**
 * RefSeq accession pattern for viral complete genomic molecules.
 *
 * The identifier after the underscore is alphanumeric and of variable length,
 * so `NC_003619`, `NC_010314` and `NC_ABC123` all match.
 */
const REFSEQ_PATTERN = /^NC_[0-9A-Z]+$/;

/** A GenBank accession split into its key and version. */
export type Accession = {
	/** The accession key. In `MN908947.3` this is `MN908947`. */
	key: string;
	/** The version number. In `MN908947.3` this is `3`. */
	version: number;
};

/**
 * Parse a versioned accession string such as `MN908947.3`.
 *
 * Returns `null` rather than throwing, because every caller here is filtering
 * a list NCBI sent — an unparseable entry is a row to drop, not a fault.
 */
export function getAccession(value: string): Accession | null {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	const parts = trimmed.split(".");

	if (parts.length !== 2) {
		return null;
	}

	const [key, rawVersion] = parts;

	if (!key || !rawVersion || !/^\d+$/.test(rawVersion)) {
		return null;
	}

	return { key, version: Number(rawVersion) };
}

/** Render an accession back to its `KEY.VERSION` string form. */
export function formatAccession(accession: Accession): string {
	return `${accession.key}.${accession.version}`;
}

/** Whether an accession key belongs to NCBI's RefSeq database. */
export function isRefSeq(key: string): boolean {
	return REFSEQ_PATTERN.test(key);
}

/**
 * Keep only the entries of `values` that parse as accessions, deduplicated by
 * key and version and sorted the way `Accession` orders in ref-builder: by key,
 * then by version.
 */
export function filterAccessions(values: Iterable<string>): Accession[] {
	const seen = new Map<string, Accession>();

	for (const value of values) {
		const accession = getAccession(value);

		if (accession !== null) {
			seen.set(formatAccession(accession), accession);
		}
	}

	return [...seen.values()].sort(
		(a, b) => a.key.localeCompare(b.key) || a.version - b.version,
	);
}
