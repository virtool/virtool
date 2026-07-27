// The analysis wire shapes — `Analysis`, `AnalysisMinimal`, `AnalysisFile` and
// the search result — are served by `@server/analyses/functions` and live in
// `@virtool/contracts`. What stays here is the client's own reading of the
// opaque `results` blob: the shapes `utils.ts` derives for rendering, which the
// server has no notion of.

import type {
	Analysis,
	AnalysisFile,
	AnalysisMinimal,
	NuvsBlast,
} from "@virtool/contracts";

/**
 * An analysis narrowed to the workflow-specific shape its `results` blob takes
 * once `formatData` has derived the rendering metrics.
 */
export type FormattedAnalysis =
	| FormattedPathoscopeAnalysis
	| FormattedNuvsAnalysis
	| Analysis;

export type FormattedPathoscopeAnalysis = AnalysisMinimal & {
	files: AnalysisFile[];
	results: FormattedPathoscopeResults;
	workflow: "pathoscope";
};

/** All results for a pathoscope analysis*/
export type FormattedPathoscopeResults = {
	/** The hit OTUs and metrics */
	hits: FormattedPathoscopeHit[];

	/** The total number of reads mapped to the reference during the analysis*/
	readCount: number;

	/** The number of reads that were mapped to subtractions*/
	subtractedCount: number;
};

/** Mapping data for a single pathoscope hit*/
export type FormattedPathoscopeHit = {
	/** The abbreviation of the hit OTU */
	abbreviation: string;

	/** The proportion of the sequence that has mapped read coverage*/
	coverage: number;

	/** The average depth of coverage for the sequence */
	depth: number;

	/** the position mapped depths of the reference sequence*/
	filled: PositionMappedReadDepths;

	/** The ID of the hit OTU */
	id: string;

	/** The isolates of the hit OTU */
	isolates: FormattedPathoscopeIsolate[];

	length: number;

	/** The largest depth on any single reference nucleotide */
	maxDepth: number;

	/** The longest sequence length sum of all isolates */
	maxGenomeLength: number;

	/** The name of the hit OTU */
	name: string;

	/** The proportion of reads from the entire sample that match this hit */
	pi: number;

	/** Estimated number of reads mapped to the OTU */
	reads: number;

	/** The version of the hit OTU */
	version: number;
};

/** Mapping data for a single pathoscope reference isolate */
export type FormattedPathoscopeIsolate = {
	coverage: number;
	default: boolean;
	depth: number;
	filled: number[];
	id: string;
	name: string;
	pi: number;
	sequences: FormattedPathoscopeSequence[];
	source_name: string;
	source_type: string;
};

/** The mapping data for a single pathoscope reference sequence*/
export type FormattedPathoscopeSequence = {
	/** The ID of the hit sequence */
	id: string;

	/** The Genbank accession number of the hit sequence */
	accession: string;

	/** alignment coordinates  */
	align: [number, number][];

	best: number;

	/** The proportion of the sequence that has mapped read coverage*/
	coverage: number;

	/** A description of the sequence */
	definition: string;

	/** the per-position mapped read depths, derived from the alignment */
	filled: number[];

	length: number;

	/** The proportion of reads from the entire sample that match this hit */
	pi: number;

	/** The number of reads that match this hit */
	reads: number;
};

/** Complete Nuvs analysis details */
export type FormattedNuvsAnalysis = AnalysisMinimal & {
	files: Array<AnalysisFile>;
	maxSequenceLength: number;
	results: FormattedNuvsResults;
	workflow: "nuvs";
};

/** All results for a Nuvs analysis */
export type FormattedNuvsResults = {
	hits: FormattedNuvsHit[];
};

/** Mapping data for a single Nuvs hit */
export type FormattedNuvsHit = {
	annotatedOrfCount: number;
	blast: Blast | null;
	e: number;
	families: string[];
	id: number;
	index: number;
	name: string[];
	orfs: NuvsOrf[];
	sequence: string;
};

/**
 * A BLAST request, with NCBI's verbatim `result` narrowed to the shape this side
 * renders. The envelope itself is the wire shape from `@virtool/contracts`,
 * which leaves `result` an uninterpreted JSON object.
 */
export type Blast = Omit<NuvsBlast, "result"> & {
	result: BlastResults | null;
};

export type BlastResults = {
	hits: BlastHit[];
	masking: BlastMask[];
	params: { [key: string]: string | number };
	program: string;
	stat: { [key: string]: number };
	target: { [key: string]: string };
	version: string;
	rid: string;
	updated_at: string;
};

export type BlastHit = {
	accession: string;
	align_len: number;
	bit_score: number;
	evalue: number;
	gaps: number;
	identity: number;
	len: number;
	name: string;
	score: number;
	taxid: number;
	title: string;
};

export type BlastMask = {
	from: number;
	to: number;
};

export type NuvsOrfHit = {
	cluster: number;
	best_bias: number;
	best_e: number;
	best_score: number;
	families: { [key: string]: number };
	full_bias: number;
	full_e: number;
	full_score: number;
	hit: number;
	names: string[];
};

export type NuvsOrf = {
	frame: number;
	hits: NuvsOrfHit[];
	index: number;
	pos: number[];
	pro: string;
	strand: number;
};

/** Read depths of a sequence mapped by position to an array */
export type PositionMappedReadDepths = number[];
