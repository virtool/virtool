/**
 * The scratch every step of a run shares.
 *
 * Replaces Python's `intermediate` namespace and its `results` dict, which were
 * two objects because fixtures resolved them separately. Here they are one, and
 * it is plain mutable state on the run context rather than anything injected.
 */

/** Cross-step scratch for one pathoscope run. */
export type PathoscopeState = {
	/**
	 * The reference sequences the sample's reads mapped to.
	 *
	 * Empty until `map_default_isolates` fills it, and **an empty set after that
	 * step is a legitimate outcome**: the sample carries nothing this reference
	 * knows about. Four later steps short-circuit on it, because `bowtie2-build`
	 * exits 1 on an empty FASTA and every step after that has no index to map
	 * against.
	 */
	candidateSequenceIds: string[];

	/**
	 * Reads dropped for aligning at least as well to a subtraction, accumulated
	 * across every subtraction pass.
	 */
	subtractedCount: number;
};

export function createPathoscopeState(): PathoscopeState {
	return { candidateSequenceIds: [], subtractedCount: 0 };
}
