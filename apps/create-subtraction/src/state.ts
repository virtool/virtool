/**
 * The scratch every step of a run shares.
 *
 * Replaces Python's `intermediate` namespace. `compute_gc_and_count` fills both
 * fields and `finalize` sends them; they are null until then rather than zeroed,
 * so a finalize reached without the scan having run fails instead of recording
 * an empty genome.
 */

import type { NucleotideComposition } from "@virtool/contracts";

/** Cross-step scratch for one create_subtraction run. */
export type CreateSubtractionState = {
	/** Sequence count, as `compute_gc_and_count` measured it. */
	count: number | null;

	/** Nucleotide composition, rounded to three places. */
	gc: NucleotideComposition | null;
};

export function createCreateSubtractionState(): CreateSubtractionState {
	return { count: null, gc: null };
}
