// The pathoscope workflow's shapes: the `results` blob once the server has
// formatted it, at all three organisational levels.
//
// The *raw* blob is the worker's contract and stays exactly as the workflow
// wrote it — `Analysis.results` types it as an opaque `JsonObject` for that
// reason. What is declared here is the formatted envelope, which is ours: the
// server derives every coverage and depth figure from the raw alignments, before
// they are reduced to drawable polylines, and the client renders what it is
// given.

/**
 * An `[x, y]` point in a coverage polyline.
 *
 * Coverage is sent as a polyline rather than a per-position depth array: the
 * arrays are as long as the reference genome, which is orders of magnitude more
 * points than a chart a few hundred pixels wide can draw.
 */
export type Coordinate = [number, number];

/** A pathoscope hit against one reference sequence. */
export type PathoscopeSequence = {
	/** The Genbank accession number */
	accession: string;

	/** The coverage polyline, simplified for drawing, or null if none was recorded */
	align: Coordinate[] | null;

	/** The best alignment score recorded against the sequence */
	best: number;

	/** The proportion of the sequence with mapped read coverage */
	coverage: number;

	/** A description of the sequence */
	definition: string;

	/** The unique identifier */
	id: string;

	/** The length of the reference sequence in nucleotides */
	length: number;

	/** The proportion of reads from the entire sample that match this hit */
	pi: number;

	/** The number of reads the workflow assigned to this sequence */
	reads: number;
};

/** A detected isolate, with the metrics derived from the sequences it owns. */
export type PathoscopeIsolate = {
	/** The proportion of the isolate's positions with mapped read coverage */
	coverage: number;

	/** The median read depth across the isolate, in whole reads */
	depth: number;

	/** The unique identifier */
	id: string;

	/** The isolate's display name */
	name: string;

	/** The summed length of the isolate's sequences */
	length: number;

	/** The proportion of reads from the entire sample that match this isolate */
	pi: number;

	/** The hit sequences, shortest first */
	sequences: PathoscopeSequence[];
};

/** A detected OTU, with the metrics derived from the isolates it owns. */
export type PathoscopeHit = {
	/** The abbreviation of the OTU, as it was at the analysed version */
	abbreviation: string;

	/**
	 * The isolate coverage polylines merged into one, simplified for drawing.
	 *
	 * Each position takes the greatest depth any isolate recorded there, so the
	 * curve represents the OTU rather than any single isolate.
	 */
	align: Coordinate[];

	/** The greatest coverage any of the OTU's isolates achieved */
	coverage: number;

	/** The median read depth across the merged curve, in whole reads */
	depth: number;

	/** The unique identifier */
	id: string;

	/** The detected isolates, highest coverage first */
	isolates: PathoscopeIsolate[];

	/** The length of the longest sequence in the OTU */
	length: number;

	/** The greatest depth recorded on any single nucleotide */
	maxDepth: number;

	/** The length of the longest isolate, which the merged curve spans */
	maxGenomeLength: number;

	/** The name of the OTU, as it was at the analysed version */
	name: string;

	/** The proportion of reads from the entire sample that match this OTU */
	pi: number;

	/** The version of the OTU the analysis saw */
	version: number;
};

/** A formatted pathoscope analysis's results. */
export type PathoscopeResults = {
	/** The detected OTUs and their metrics */
	hits: PathoscopeHit[];

	/** The number of reads mapped to the reference during the analysis */
	readCount: number;

	/** The number of reads mapped to the subtractions */
	subtractedCount: number;
};
