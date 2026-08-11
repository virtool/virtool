/**
 * The cache namespaces this workflow reads and writes, and the params each key
 * is derived from.
 *
 * `deriveCacheKey` reproduces Python's `derive_key` byte for byte, so a params
 * object that matches Python's derives the same key and the two implementations
 * share the artifact. That sharing is silent when it works and silent when it
 * does not — a divergence misses every lookup and writes a second copy under a
 * key nothing else will ever ask for — so the two shared namespaces below are
 * pinned by tests against known Python-generated keys.
 *
 * ## Two namespaces are shared and one is forked
 *
 * - `reference_mapping_index` and `subtraction_mapping_index` are **shared**.
 *   Their artifact is a bowtie2 index, which `bowtie2-build` produces
 *   identically from either implementation, so a Python-written entry is
 *   interchangeable with a TypeScript-written one.
 * - `collapsed_reference` is **forked**, deliberately. Its artifact is a SQLite
 *   index *this code* writes, and byte-level interchangeability with Python's
 *   writer is not something either side guarantees. {@link COLLAPSE_IMPL}
 *   is the discriminator that makes the derived key differ by construction, so
 *   the two namespaces cannot collide during the cutover. Removing it would let
 *   a Python-written collapsed index be restored here and analysed as though
 *   this code had produced it.
 */

import type { CacheParams, RunSubprocess } from "@virtool/workflow";
import { CD_HIT_EST_IDENTITY, CD_HIT_EST_TOOL } from "./reference/collapse";

export const WORKFLOW_NAME = "pathoscope";

const BOWTIE2_BUILD_TOOL = "bowtie2-build";

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
 * Params for the two shared mapping-index namespaces.
 *
 * Every key here must match Python's `get_mapping_index_cache_params` exactly.
 * There is deliberately no discriminator: sharing is the point.
 *
 * **`parent_id` is a number, not a string.** Python's type hint says `str` but
 * both call sites pass an `int` — `WFIndex.id` and `WFSubtraction.id` are both
 * `int` — and `json.dumps` writes `"parent_id":5` where a string would give
 * `"parent_id":"5"`. Quoting it here derives a different SHA-256 and shares
 * nothing, with nothing to tell you.
 */
export function buildMappingIndexCacheParams({
	extra,
	indexKind,
	parentId,
	toolVersion,
	workflowVersion,
}: {
	extra?: Record<string, string>;
	indexKind: "reference_mapping_index" | "subtraction_mapping_index";
	parentId: number;
	toolVersion: string;
	workflowVersion: string;
}): CacheParams {
	return {
		index_kind: indexKind,
		parent_id: parentId,
		tool_name: BOWTIE2_BUILD_TOOL,
		tool_version: toolVersion,
		workflow: WORKFLOW_NAME,
		workflow_version: workflowVersion,
		...extra,
	};
}

/** What the reference mapping index adds, describing the FASTA it was built from. */
export const REFERENCE_INDEX_EXTRA_PARAMS = {
	collapse_identity: CD_HIT_EST_IDENTITY,
	selection: "default_isolates",
	source: "collapsed_reference",
};

/**
 * Read `bowtie2-build`'s version.
 *
 * `bowtie2-build --version` writes to stdout and exits 0, unlike cd-hit-est
 * below.
 *
 * @throws {Error} when the output carries no recognisable version.
 */
export async function getBowtie2BuildVersion(
	runSubprocess: RunSubprocess,
): Promise<string> {
	const lines: string[] = [];

	await runSubprocess({
		command: [BOWTIE2_BUILD_TOOL, "--version"],
		stdout: (line) => {
			lines.push(line);
		},
	});

	return matchVersion(
		/\bversion\s+(\S+)/,
		lines,
		"Could not parse bowtie2-build version",
	);
}

/**
 * Read `cd-hit-est`'s version.
 *
 * **`cd-hit-est -h` prints its help text and exits 1**, so the subprocess
 * failure is caught and the output parsed anyway. There is no `--version` flag
 * to use instead. Both streams are collected because the tool has moved the
 * banner between them across releases.
 *
 * @throws {Error} when the output carries no recognisable version.
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

	return matchVersion(
		/\bCD-HIT\s+version\s+(\S+)/,
		lines,
		"Could not parse cd-hit-est version",
	);
}

function matchVersion(
	pattern: RegExp,
	lines: readonly string[],
	message: string,
): string {
	// Joined with a newline, not the empty string. Python concatenates lines that
	// still carry their terminator, so `"".join(...)` reproduces the original
	// text; the runtime's line handler has already stripped it, and joining with
	// nothing would run the last word of one line into the first of the next.
	const match = pattern.exec(lines.join("\n"));

	const version = match?.[1];

	if (version === undefined) {
		throw new Error(message);
	}

	return version;
}
