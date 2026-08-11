/**
 * Building a bowtie2 index, and reusing one another run already built.
 *
 * Shared by `create_reference_index` and `create_subtraction_index`, which
 * differ only in what they build from and which cache namespace they use.
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Logger } from "@virtool/logger";
import {
	deriveCacheKey,
	type RunSubprocess,
	type WorkflowCache,
} from "@virtool/workflow";
import {
	buildMappingIndexCacheParams,
	getBowtie2BuildVersion,
} from "./cacheParams";

const BOWTIE2_BUILD_TOOL = "bowtie2-build";

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

/** What {@link createMappingIndex} needs to build or restore one index. */
export type CreateMappingIndexOptions = {
	cache: WorkflowCache;
	/** Extra params for the reference index, describing the FASTA it was built from. */
	extraParams?: Record<string, string>;
	fastaPath: string;
	indexKind: "reference_mapping_index" | "subtraction_mapping_index";
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
	workflowVersion: string;
};

/**
 * Restore a bowtie2 index from the cache, or build it and cache it.
 *
 * **The cached artifact is the index's whole directory**, and it is restored
 * into that directory's parent — so a `reference_index/reference*.bt2` set is
 * archived as `reference_index/` and unpacks to the same place. That is what
 * makes the layout in `paths.ts` part of the cache contract rather than a local
 * convention.
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
	workflowVersion,
}: CreateMappingIndexOptions): Promise<void> {
	const indexDir = dirname(indexPrefix);

	const params = buildMappingIndexCacheParams({
		extra: extraParams,
		indexKind,
		parentId,
		toolVersion: await getBowtie2BuildVersion(runSubprocess),
		workflowVersion,
	});

	const key = deriveCacheKey(params);
	const log = logger.child({ indexKind, key, parentId });

	const restored = await cache.get(key, dirname(indexDir));

	if (restored !== null) {
		// A blob's one top-level entry is named after the directory its writer
		// archived, and both namespaces here are shared with Python — so a blob
		// archived from a differently named directory unpacks *beside* the index
		// rather than onto it. Thrown rather than treated as a miss: `cache.put`
		// cannot replace a registered key, so rebuilding would hand the same blob
		// back to every later run while leaving the stray tree on a disk sized for
		// one copy of the index. Reported here, where the key and the two paths
		// say what is wrong, rather than as bowtie2 failing on a missing index.
		if (restored !== indexDir) {
			throw new Error(
				`Cached ${indexKind} restored to ${restored}, not ${indexDir}`,
			);
		}

		log.info("restored cached mapping index");

		return;
	}

	log.info("building mapping index");

	await prepareFasta();

	await buildBowtie2Index(runSubprocess, fastaPath, indexPrefix, proc);

	// An already-registered key is success, not an error: another run can have
	// derived the same key and built the same index while this one was working.
	const created = await cache.put(key, indexDir, params);

	log.info({ created }, "cached mapping index");
}
