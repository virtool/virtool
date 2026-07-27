// The analysis wire shapes — `Analysis`, `AnalysisMinimal`, `AnalysisFile`, the
// search result, and the formatted `results` envelopes — are served by
// `@server/analyses/functions` and live in `@virtool/contracts`. What stays here
// is the client's own narrowing of what the server leaves opaque: NCBI's BLAST
// response, and the analysis shapes that carry it.

import type {
	AnalysisFile,
	AnalysisMinimal,
	NuvsBlast,
	NuvsHit,
	NuvsResults,
	PathoscopeResults,
} from "@virtool/contracts";

/** A complete pathoscope analysis, with its results shaped by the server. */
export type FormattedPathoscopeAnalysis = AnalysisMinimal & {
	files: AnalysisFile[];
	results: PathoscopeResults;
	workflow: "pathoscope";
};

/**
 * A NuVs contig whose BLAST request has had NCBI's verbatim `result` narrowed to
 * the shape this side renders.
 */
export type FormattedNuvsHit = Omit<NuvsHit, "blast"> & {
	blast: Blast | null;
};

/** All results for a NuVs analysis, with BLAST responses narrowed. */
export type FormattedNuvsResults = Omit<NuvsResults, "hits"> & {
	hits: FormattedNuvsHit[];
};

/** A complete NuVs analysis, with its results shaped by the server. */
export type FormattedNuvsAnalysis = AnalysisMinimal & {
	files: AnalysisFile[];
	results: FormattedNuvsResults;
	workflow: "nuvs";
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
