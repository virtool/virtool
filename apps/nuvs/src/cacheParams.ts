/**
 * The cache namespaces this workflow reads and writes, and the params each key
 * is derived from.
 *
 * `deriveCacheKey` reproduces Python's `derive_key` byte for byte, so a params
 * object that matches Python's derives the same key and the two implementations
 * share the artifact. That sharing is silent when it works and silent when it
 * does not — a divergence misses every lookup and writes a second copy under a
 * key nothing else will ever ask for — so all three namespaces are pinned by
 * tests against known Python-generated keys.
 *
 * ## All three are shared, and none is forked
 *
 * Unlike pathoscope, which forks its `collapsed_reference` namespace because the
 * artifact is a SQLite index *this code* writes, every artifact nuvs caches is
 * produced by an external tool: `skewer` for the trimmed reads and
 * `bowtie2-build` for the two mapping indexes. Those are interchangeable
 * whoever ran them, so there is deliberately no discriminator anywhere here.
 *
 * `workflow` is a field in every one of them, so these namespaces are shared
 * with **Python nuvs**, not with pathoscope — the two workflows memoize their
 * bowtie2 indexes separately even where they would build identical shards.
 */

import {
	type CacheParams,
	float,
	type MappingIndexKind,
} from "@virtool/workflow";
import {
	SKEWER_END_QUALITY,
	SKEWER_MAX_ERROR_RATE,
	SKEWER_MAX_INDEL_RATE,
	SKEWER_MEAN_QUALITY,
	SKEWER_TOOL,
	type SkewerMode,
} from "./skewer";

export const WORKFLOW_NAME = "nuvs";

/**
 * What this workflow's reference mapping index adds, describing the FASTA it was
 * built from.
 *
 * NuVs maps against the artifact's **default isolates**, straight out of the
 * SQLite index. Pathoscope's index over the same reference is built from a
 * cd-hit-collapsed FASTA and says so with `source: "collapsed_reference"` and a
 * `collapse_identity`, which is what keeps the two out of each other's
 * namespace.
 */
export const REFERENCE_INDEX_EXTRA_PARAMS = {
	selection: "default_isolates",
	source: "index_sqlite",
};

/**
 * What this workflow's subtraction mapping index adds.
 *
 * The same `subtraction.fa.gz` either workflow starts from, so this matches
 * pathoscope's — the two differ only in the `workflow` field, which is enough to
 * separate them.
 */
export const SUBTRACTION_INDEX_EXTRA_PARAMS = { source: "subtraction_fasta" };

/** Which mapping index a step is building, as its namespace names it. */
export const REFERENCE_INDEX_KIND: MappingIndexKind = "reference_mapping_index";
export const SUBTRACTION_INDEX_KIND: MappingIndexKind =
	"subtraction_mapping_index";

/** What the `trimmed_reads` key is derived from. */
export type TrimmedReadsCacheParamsOptions = {
	minLength: number;
	mode: SkewerMode;
	/** The sample the reads belong to. */
	sampleId: number;
	toolVersion: string;
	workflowVersion: string;
};

/**
 * Params for the `trimmed_reads` namespace.
 *
 * **The discriminator key is `kind`, not `index_kind`.** The two mapping-index
 * namespaces spell it `index_kind`; this one does not, because Python's
 * `get_trimmed_reads_cache_params` does not. They are different dicts in
 * `utils.py` and the inconsistency is Python's — reproduced rather than tidied,
 * since tidying it forks the namespace.
 *
 * **`max_error_rate` and `max_indel_rate` are wrapped in {@link float}.** They
 * are Python floats, and an unmarked number serialises as an integer:
 * `json.dumps(0.1)` and `JSON.stringify(0.1)` agree, so today the two keys match
 * either way. They stop agreeing the moment either is configured to a whole
 * number — `1.0` against `1` — which is a divergence with nothing to announce
 * it.
 */
export function buildTrimmedReadsCacheParams({
	minLength,
	mode,
	sampleId,
	toolVersion,
	workflowVersion,
}: TrimmedReadsCacheParamsOptions): CacheParams {
	return {
		end_quality: SKEWER_END_QUALITY,
		kind: "trimmed_reads",
		max_error_rate: float(SKEWER_MAX_ERROR_RATE),
		max_indel_rate: float(SKEWER_MAX_INDEL_RATE),
		mean_quality: SKEWER_MEAN_QUALITY,
		min_length: minLength,
		mode,
		parent_id: sampleId,
		tool_name: SKEWER_TOOL,
		tool_version: toolVersion,
		workflow: WORKFLOW_NAME,
		workflow_version: workflowVersion,
	};
}
