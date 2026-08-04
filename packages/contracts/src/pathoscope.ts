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

	/**
	 * The key of the OTU segment this sequence fills.
	 *
	 * Matches one `PathoscopeSegmentCoverage.key` on the parent hit, which is what
	 * lets the isolates be laid out in columns — a segment an isolate has no
	 * sequence for leaves its column empty rather than shifting the rest along.
	 */
	segmentKey: string;
};

/** A detected isolate, with the metrics derived from the sequences it owns. */
export type PathoscopeIsolate = {
	/**
	 * The keys of the OTU's segments the isolate declares no sequence for.
	 *
	 * Read against the OTU version the analysis saw, over every sequence it
	 * declares rather than only the ones that were hit — so it separates an
	 * isolate that does not carry a segment from one that carries it and was
	 * assigned no reads. The two are indistinguishable from {@link sequences},
	 * which holds only the hits.
	 *
	 * Only named segments can appear. A length-inferred segment is a bin over the
	 * sequences that *were* hit, so an unhit sequence has no bin to fall in and
	 * the isolate's membership is not knowable; those are absent from this list
	 * whether the isolate carries them or not.
	 */
	absentSegmentKeys: string[];

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

/**
 * One of an OTU's genome segments, with its isolates' curves merged into one.
 *
 * A segment is matched across isolates by the schema segment its sequences name,
 * and by sequence length where they name none. An unsegmented OTU has exactly
 * one of these.
 */
export type PathoscopeSegmentCoverage = {
	/**
	 * The isolates' coverage polylines for this segment merged into one,
	 * simplified for drawing.
	 *
	 * Each position takes the greatest depth any isolate recorded there, so the
	 * curve represents the OTU rather than any single isolate. An isolate carrying
	 * no sequence for the segment contributes nothing rather than zeroes.
	 */
	align: Coordinate[];

	/**
	 * Whether any isolate recorded a hit against this segment.
	 *
	 * A declared segment nothing mapped to is still reported, so a partial
	 * detection reads as one rather than as an OTU whose reference never had the
	 * segment. It carries no curve and no isolate's sequences name it, and it is
	 * left out of the OTU's depth figures — counting it would move a headline
	 * number on how complete the *reference* is rather than on what was found.
	 */
	detected: boolean;

	/** The key the isolates' sequences name this segment by */
	key: string;

	/** The length the polyline spans — the longest sequence filling this segment */
	length: number;

	/** The schema segment name, or null when the segment was inferred by length */
	name: string | null;
};

/** A detected OTU, with the metrics derived from the isolates it owns. */
export type PathoscopeHit = {
	/** The abbreviation of the OTU, as it was at the analysed version */
	abbreviation: string;

	/** The greatest coverage any of the OTU's isolates achieved */
	coverage: number;

	/** The median read depth across the merged curves, in whole reads */
	depth: number;

	/** The unique identifier */
	id: string;

	/** The detected isolates, highest coverage first */
	isolates: PathoscopeIsolate[];

	/** The length of the longest sequence in the OTU */
	length: number;

	/** The greatest depth recorded on any single nucleotide */
	maxDepth: number;

	/** The name of the OTU, as it was at the analysed version */
	name: string;

	/** The proportion of reads from the entire sample that match this OTU */
	pi: number;

	/**
	 * The OTU's genome segments, in the order they should be drawn.
	 *
	 * Segments the schema declares come first, in schema order, then any named but
	 * not declared, then those inferred by length, longest first.
	 */
	segments: PathoscopeSegmentCoverage[];

	/** The version of the OTU the analysis saw */
	version: number;
};

/** A formatted pathoscope analysis's results. */
export type PathoscopeResults = {
	/** The detected OTUs and their metrics */
	hits: PathoscopeHit[];

	/**
	 * The number of reads mapped to the reference and kept — subtracted reads
	 * are already gone. Add {@link subtractedCount} for the number that mapped
	 * before subtraction.
	 */
	readCount: number;

	/**
	 * The number of reads that mapped to the reference but aligned at least as
	 * well to a subtraction, and were removed before reassignment.
	 */
	subtractedCount: number;
};
