/**
 * The cache namespaces this workflow reads and writes, and the params each key
 * is derived from.
 *
 * `deriveCacheKey` serialises the params byte for byte, so a params object that
 * matches the one a blob was archived under derives the same key and the run
 * reuses that blob. That reuse is silent when it works and silent when it does
 * not — a divergence misses every lookup and writes a second copy under a key
 * nothing else will ever ask for — so the shared namespaces are pinned by tests
 * against the keys blobs already in the bucket were written under.
 *
 * ## Two namespaces are shared and one is forked
 *
 * - `reference_mapping_index` and `subtraction_mapping_index` are **shared**,
 *   and their params are the runtime's `buildMappingIndexCacheParams` rather
 *   than anything declared here. Their artifact is a bowtie2 index, which
 *   `bowtie2-build` produces identically whoever ran it, so this side
 *   contributes only {@link WORKFLOW_NAME} and
 *   {@link buildReferenceIndexExtraParams} — what the index was built from.
 * - `collapsed_reference` is **forked**, deliberately, and is this workflow's
 *   alone. Its artifact is a SQLite index *this code* writes, and a collapsed
 *   index from the shared namespace is not interchangeable with it.
 *   {@link COLLAPSE_IMPL} is the discriminator that makes the derived key
 *   differ by construction, so the two namespaces cannot collide. Removing it
 *   would let a collapsed index this code did not write be restored here and
 *   analysed as though it had.
 */

import {
	type CacheParams,
	CD_HIT_EST_TOOL,
	REFERENCE_REPRESENTATIVE_POLICY,
} from "@virtool/workflow";
import { CD_HIT_EST_IDENTITY } from "./reference/collapse";

export const WORKFLOW_NAME = "pathoscope";

/**
 * The discriminator that forks the `collapsed_reference` namespace away from
 * the shared one.
 *
 * A field the shared namespace's params do not carry, so the sorted-key
 * serialization differs and so does the SHA-256 over it. Bump the value if the
 * collapsed artifact's content ever changes shape; do not remove it.
 */
const COLLAPSE_IMPL = "typescript-v2";

/** Params for the forked `collapsed_reference` namespace. */
export function buildCollapsedReferenceCacheParams({
	indexId,
	toolVersion,
	workflowVersion,
}: {
	indexId: number;
	toolVersion: string;
	workflowVersion: string;
}): CacheParams {
	return {
		identity: CD_HIT_EST_IDENTITY,
		impl: COLLAPSE_IMPL,
		index_kind: "collapsed_reference",
		parent_id: indexId,
		source: "index_sqlite",
		tool_name: CD_HIT_EST_TOOL,
		tool_version: toolVersion,
		workflow: WORKFLOW_NAME,
		workflow_version: workflowVersion,
	};
}

/**
 * What this workflow's reference mapping index adds, describing the FASTA it was
 * built from.
 *
 * Pathoscope maps against representatives selected from the full source
 * reference. These fields keep that policy out of every older or differently
 * selected mapping-index namespace.
 */
export function buildReferenceIndexExtraParams(
	toolVersion: string,
): Record<string, string> {
	return {
		selection: "cd_hit_est_representatives",
		selection_coverage: REFERENCE_REPRESENTATIVE_POLICY.coverage,
		selection_identity: REFERENCE_REPRESENTATIVE_POLICY.identity,
		selection_minimum_length: REFERENCE_REPRESENTATIVE_POLICY.minimumLength,
		selection_policy_version: REFERENCE_REPRESENTATIVE_POLICY.version,
		selection_source: "full_source_reference",
		selection_tool: CD_HIT_EST_TOOL,
		selection_tool_version: toolVersion,
		selection_word_size: REFERENCE_REPRESENTATIVE_POLICY.wordSize,
	};
}
