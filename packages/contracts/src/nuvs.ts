// The NuVs workflow's shapes: the BLAST requests made against its contigs, and
// the `results` blob once the server has formatted it.
//
// The *raw* blob is the worker's contract and stays exactly as the workflow
// wrote it — `Analysis.results` types it as an opaque `JsonObject` for that
// reason. What is declared here is the formatted envelope, which is ours: the
// server merges the HMM annotations in and derives every display metric, and the
// client renders what it is given.

import type { JsonObject } from "./json";

/**
 * A BLAST request against one NuVs contig.
 *
 * The envelope is ours; `result` is NCBI's response, stored and returned
 * verbatim, so it stays an uninterpreted JSON object at this boundary. A caller
 * that renders it narrows `result` to its own shape.
 */
export type NuvsBlast = {
	/** When the request was made */
	createdAt: Date;

	/** Why the request failed, or null if it has not */
	error: string | null;

	/** The unique identifier */
	id: number;

	/** Seconds to wait before polling NCBI again */
	interval: number | null;

	/** When the request was last polled against NCBI */
	lastCheckedAt: Date;

	/** Whether NCBI has returned a result */
	ready: boolean;

	/** NCBI's response, stored verbatim */
	result: JsonObject | null;

	/** NCBI's request id, absent until the request is accepted */
	rid: string | null;

	/** The index of the NuVs contig the request was made for */
	sequenceIndex: number;

	/** When the request was last updated */
	updatedAt: Date;
};

/** An HMM annotation matched against a NuVs open reading frame. */
export type NuvsOrfHit = {
	best_bias: number;
	best_e: number;
	best_score: number;

	/** The HMM cluster, merged in from the annotation */
	cluster: number;

	/** The viral families the annotation belongs to, merged in from the annotation */
	families: { [key: string]: number };

	full_bias: number;
	full_e: number;
	full_score: number;

	/** The id of the matched annotation */
	hit: number;

	/** The annotation's names, merged in from the annotation */
	names: string[];
};

/** An open reading frame found in a NuVs contig. */
export type NuvsOrf = {
	frame: number;
	hits: NuvsOrfHit[];
	index: number;
	pos: number[];
	pro: string;
	strand: number;
};

/** A NuVs contig, with the metrics derived from its open reading frames. */
export type NuvsHit = {
	/** The number of the contig's ORFs that matched at least one annotation */
	annotatedOrfCount: number;

	/** The BLAST request made against this contig, if any */
	blast: NuvsBlast | null;

	/** The lowest e-value across the contig's ORF hits, or null if it has no ORFs */
	e: number | null;

	/** Every viral family named by the contig's ORF hits */
	families: string[];

	/** The unique identifier, which is the contig's index */
	id: number;

	/** The contig's position in the workflow's output */
	index: number;

	/** Every annotation name given to the contig's ORF hits */
	names: string[];

	/** The open reading frames found in the contig */
	orfs: NuvsOrf[];

	/** The assembled nucleotide sequence */
	sequence: string;
};

/** A formatted NuVs analysis's results. */
export type NuvsResults = {
	/** The assembled contigs and their metrics */
	hits: NuvsHit[];

	/** The length of the longest contig, which the sequence rulers scale to */
	maxSequenceLength: number;
};
