/**
 * Building a bowtie2 index, and reusing one another run already built.
 *
 * This lives in the runtime rather than in one workflow app because every
 * workflow that maps against a reference or a subtraction builds its index the
 * same way and derives its key from the same fields.
 *
 * **Each workflow has its own namespaces.** The workflow name and version are
 * fields in every derived key — and in every key already in the bucket — so
 * pathoscope and nuvs never restore each other's indexes. That is deliberate:
 * the two workflows prepare different FASTA files, and a key that omitted them
 * would restore an index built from other input with nothing to report it.
 * Hardcoding the name here would silently give every caller the first one's
 * namespace.
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { JobWorkflow } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { restoreOrBuild, type WorkflowCache } from "../cache/cache";
import type { CacheParams } from "../cache/key";
import type { RunSubprocess } from "../subprocess/types";
import { matchToolVersion } from "../subprocess/version";

const BOWTIE2_BUILD_TOOL = "bowtie2-build";

/** Which artifact a mapping index is, and so which namespace it caches under. */
export type MappingIndexKind =
	| "reference_mapping_index"
	| "subtraction_mapping_index";

/** Run `bowtie2-build` over `fastaPath`, writing shards at `indexPrefix`. */
export async function buildBowtie2Index(
	runSubprocess: RunSubprocess,
	fastaPath: string,
	indexPrefix: string,
	proc: number,
): Promise<void> {
	await mkdir(dirname(indexPrefix), { recursive: true });

	await runSubprocess({
		command: [
			BOWTIE2_BUILD_TOOL,
			"--threads",
			String(proc),
			fastaPath,
			indexPrefix,
		],
	});
}

/**
 * Read `bowtie2-build`'s version.
 *
 * `bowtie2-build --version` writes to stdout and exits 0, unlike some of the
 * other tools a workflow runs.
 *
 * @throws {WorkflowError} when the output carries no recognisable version.
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

	return matchToolVersion(
		/\bversion\s+(\S+)/,
		lines,
		"Could not parse bowtie2-build version",
	);
}

/**
 * Params for the two shared mapping-index namespaces.
 *
 * This field set is frozen: blobs already in the bucket are addressed by keys
 * derived from exactly these fields.
 *
 * **`parent_id` is a number, not a string.** `WFIndex.id` and
 * `WFSubtraction.id` are both integers, and the canonical form writes
 * `"parent_id":5` where a string would give `"parent_id":"5"`. Quoting it here
 * derives a different SHA-256 and shares nothing, with nothing to tell you.
 *
 * `extra` is what describes the FASTA the index was built from, and it differs
 * per workflow: pathoscope builds its reference index off a collapsed reference,
 * nuvs straight off the artifact's default isolates. A caller that gets it wrong
 * restores an index a different version of itself built from different bytes.
 */
export function buildMappingIndexCacheParams({
	extra,
	indexKind,
	parentId,
	toolVersion,
	workflow,
	workflowVersion,
}: {
	extra?: Record<string, string>;
	indexKind: MappingIndexKind;
	parentId: number;
	toolVersion: string;
	workflow: JobWorkflow;
	workflowVersion: string;
}): CacheParams {
	return {
		index_kind: indexKind,
		parent_id: parentId,
		tool_name: BOWTIE2_BUILD_TOOL,
		tool_version: toolVersion,
		workflow,
		workflow_version: workflowVersion,
		...extra,
	};
}

/** What {@link createMappingIndex} needs to build or restore one index. */
export type CreateMappingIndexOptions = {
	cache: WorkflowCache;
	/** Extra params describing the FASTA the index is built from. */
	extraParams?: Record<string, string>;
	fastaPath: string;
	indexKind: MappingIndexKind;
	/** The bowtie2 prefix — the shards are written beside it. */
	indexPrefix: string;
	logger: Logger;
	/** The index or subtraction the artifact belongs to. */
	parentId: number;
	/**
	 * Put the FASTA at `fastaPath`, called only once the cache has missed.
	 *
	 * A producer rather than a file the caller has already placed: on a hit the
	 * index is restored and the FASTA is never opened, so scanning the reference
	 * for one or pulling a subtraction genome out of storage up front is
	 * gigabytes of work for nothing.
	 */
	prepareFasta: () => Promise<void>;
	proc: number;
	runSubprocess: RunSubprocess;
	/** The calling workflow, which is a field in the derived key. */
	workflow: JobWorkflow;
	workflowVersion: string;
};

/**
 * Restore a bowtie2 index from the cache, or build it and cache it.
 *
 * **The cached artifact is the index's whole directory**, and it is restored
 * into that directory's parent — so a `reference_index/reference*.bt2` set is
 * archived as `reference_index/` and unpacks to the same place. That is what
 * makes a caller's work-path layout part of the cache contract rather than a
 * local convention: the directory holding `indexPrefix` is named inside the
 * blob, and it is a blob every later run of the workflow may restore.
 */
export async function createMappingIndex({
	cache,
	extraParams,
	fastaPath,
	indexKind,
	indexPrefix,
	logger,
	parentId,
	prepareFasta,
	proc,
	runSubprocess,
	workflow,
	workflowVersion,
}: CreateMappingIndexOptions): Promise<void> {
	const params = buildMappingIndexCacheParams({
		extra: extraParams,
		indexKind,
		parentId,
		toolVersion: await getBowtie2BuildVersion(runSubprocess),
		workflow,
		workflowVersion,
	});

	await restoreOrBuild({
		cache,
		kind: indexKind,
		params,
		directory: dirname(indexPrefix),
		logger: logger.child({ parentId }),
		async build() {
			await prepareFasta();
			await buildBowtie2Index(runSubprocess, fastaPath, indexPrefix, proc);
		},
	});
}
