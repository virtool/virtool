/**
 * The cache namespaces this workflow reads and writes, and the params each key
 * is derived from.
 *
 * `deriveCacheKey` reproduces Python's `derive_key` byte for byte, so a params
 * object that matches Python's derives the same key and the two implementations
 * share the artifact. That sharing is silent when it works and silent when it
 * does not — a divergence misses every lookup and writes a second copy under a
 * key nothing else will ever ask for — so the shared namespaces are pinned by
 * tests against known Python-generated keys.
 *
 * ## Two namespaces are shared and one is forked
 *
 * - `reference_mapping_index` and `subtraction_mapping_index` are **shared**,
 *   and their params are the runtime's `buildMappingIndexCacheParams` rather
 *   than anything declared here. Their artifact is a bowtie2 index, which
 *   `bowtie2-build` produces identically from either implementation and from
 *   either analysis workflow, so this side contributes only {@link WORKFLOW_NAME}
 *   and {@link REFERENCE_INDEX_EXTRA_PARAMS} — what the index was built from.
 * - `collapsed_reference` is **forked**, deliberately, and is this workflow's
 *   alone. Its artifact is a SQLite index *this code* writes, and byte-level
 *   interchangeability with Python's writer is not something either side
 *   guarantees. {@link COLLAPSE_IMPL} is the discriminator that makes the
 *   derived key differ by construction, so the two namespaces cannot collide
 *   during the cutover. Removing it would let a Python-written collapsed index
 *   be restored here and analysed as though this code had produced it.
 */

import {
	type CacheParams,
	matchToolVersion,
	type RunSubprocess,
} from "@virtool/workflow";
import { CD_HIT_EST_IDENTITY, CD_HIT_EST_TOOL } from "./reference/collapse";

export const WORKFLOW_NAME = "pathoscope";

/**
 * The discriminator that forks the `collapsed_reference` namespace from
 * Python's.
 *
 * A field Python's params do not carry, so the sorted-key serialization differs
 * and so does the SHA-256 over it. Bump the value if the collapsed artifact's
 * content ever changes shape; do not remove it.
 */
const COLLAPSE_IMPL = "typescript-v1";

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
 * Pathoscope maps against a *collapsed* reference, so its index is built from
 * different bytes than one built straight off the artifact's default isolates.
 * These fields are what keep the two out of each other's namespace.
 */
export const REFERENCE_INDEX_EXTRA_PARAMS = {
	collapse_identity: CD_HIT_EST_IDENTITY,
	selection: "default_isolates",
	source: "collapsed_reference",
};

/**
 * Read `cd-hit-est`'s version.
 *
 * **`cd-hit-est -h` prints its help text and exits 1**, so the subprocess
 * failure is caught and the output parsed anyway. There is no `--version` flag
 * to use instead. Both streams are collected because the tool has moved the
 * banner between them across releases.
 *
 * @throws {WorkflowError} when the output carries no recognisable version.
 */
export async function getCdHitEstVersion(
	runSubprocess: RunSubprocess,
): Promise<string> {
	const lines: string[] = [];

	const collect = (line: string) => {
		lines.push(line);
	};

	try {
		await runSubprocess({
			command: [CD_HIT_EST_TOOL, "-h"],
			stdout: collect,
			stderr: collect,
		});
	} catch {
		// Expected: the help text is the output and exit 1 is how it ends. A tool
		// that is genuinely absent produces no matching line and fails below,
		// naming the version parse rather than the exit code.
	}

	return matchToolVersion(
		/\bCD-HIT\s+version\s+(\S+)/,
		lines,
		"Could not parse cd-hit-est version",
	);
}
