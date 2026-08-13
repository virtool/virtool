/**
 * The scratch every step of a run shares.
 *
 * Replaces Python's `intermediate` namespace. `run_fastqc` fills the one field
 * and `finalize` sends it; it is null until then rather than an empty blob, so
 * a finalize reached without the quality step having run fails instead of
 * recording a sample with no quality data.
 */

import type { Quality } from "@virtool/contracts";

/** Cross-step scratch for one create_sample run. */
export type CreateSampleState = {
	/**
	 * The sample's quality data, as `run_fastqc` measured it.
	 *
	 * For a paired sample this is already the composite of the two reads'
	 * blobs — one blob is what `legacy_samples.quality` holds.
	 */
	quality: Quality | null;
};

export function createCreateSampleState(): CreateSampleState {
	return { quality: null };
}
