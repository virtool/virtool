/**
 * The scratch every step of a run shares.
 *
 * One object rather than a scratch namespace beside a results dict, and plain
 * mutable state on the run context rather than anything injected.
 */

/** Cross-step scratch for one pathoscope run. */
export type PathoscopeState = {
	/**
	 * The OTUs owning reference representatives the sample's reads mapped to.
	 *
	 * Empty until `map_representatives` fills it, and **an empty list after that
	 * step is a legitimate outcome**: the sample carries nothing this reference
	 * knows about. Four later steps short-circuit on it, because `bowtie2-build`
	 * exits 1 on an empty FASTA and every step after that has no index to map
	 * against.
	 */
	candidateOtuIds: string[];

	/**
	 * Reads dropped for aligning at least as well to a subtraction, accumulated
	 * across every subtraction pass.
	 */
	subtractedCount: number;
};

export function createPathoscopeState(): PathoscopeState {
	return { candidateOtuIds: [], subtractedCount: 0 };
}
