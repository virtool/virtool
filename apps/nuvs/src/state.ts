/**
 * The scratch every step of a run shares, and the shape of the blob it becomes.
 *
 * Replaces Python's `results` dict. What is declared here is the **raw** results
 * shape — the workflow's own contract, stored verbatim in `analyses.results` —
 * not the envelope `@virtool/contracts`' `NuvsResults` describes. That one is
 * what `formatNuvs` (`packages/data/src/analyses/format.ts`) *produces*, after
 * merging each hit's `cluster`, `families` and `names` in from the `hmms` table
 * and deriving `annotatedOrfCount`, `e`, `id` and `blast`.
 *
 * **So this side must not write those fields.** A `families` written here is a
 * second opinion about an annotation the database owns, free to go stale the
 * moment the HMM dataset is reinstalled, and the formatter would overwrite it
 * anyway.
 */

/** One `hmmscan` match against an ORF, as the workflow records it. */
export type NuvsRawOrfHit = {
	best_bias: number;
	best_e: number;
	best_score: number;
	full_bias: number;
	full_e: number;
	full_score: number;

	/**
	 * The matched annotation's id, joined from the hit's vFam cluster.
	 *
	 * The formatter matches it against `hmms.id` *or* `hmms.legacy_id`, so an
	 * annotation predating the Postgres migration resolves by its Mongo string
	 * id. What this side writes is whatever the annotations blob carries.
	 */
	hit: number;
};

/**
 * An open reading frame, as the workflow records it.
 *
 * `nuc` is dropped on the way in — it is the ORF's nucleotide slice, which is
 * recoverable from the contig's `sequence` and `pos`, and keeping it doubles the
 * size of a blob that is already the largest thing a NuVs analysis stores.
 */
export type NuvsRawOrf = {
	frame: number;
	hits: NuvsRawOrfHit[];

	/** The ORF's position within its contig's ORF list */
	index: number;

	pos: [number, number];
	pro: string;
	strand: 1 | -1;
};

/** One assembled contig that survived filtering, as the workflow records it. */
export type NuvsRawContig = {
	/** The contig's position in the output, and the id the formatter derives */
	index: number;

	orfs: NuvsRawOrf[];
	sequence: string;
};

/** Cross-step scratch for one nuvs run. */
export type NuvsState = {
	/**
	 * The contigs the analysis is made of.
	 *
	 * Empty until `process_assembly` fills it, and legitimately empty after that:
	 * a sample carrying no novel virus assembles into nothing over 300 bp with an
	 * ORF in it. `vfam` then annotates nothing and finalizes an empty list.
	 */
	hits: NuvsRawContig[];
};

export function createNuvsState(): NuvsState {
	return { hits: [] };
}
