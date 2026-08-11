import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "@virtool/logger";
import {
	type BuildContextInput,
	createMappingIndex,
	downloadToPath,
	openWorkflowIndex,
	writeFasta,
} from "@virtool/workflow";
import { cacheFor } from "../cache";
import { REFERENCE_INDEX_EXTRA_PARAMS, WORKFLOW_NAME } from "../cacheParams";
import { workPaths } from "../paths";
import { APP_VERSION } from "../version";
import type { PathoscopeStep } from "./types";

/**
 * Build the bowtie2 index the candidate search maps against.
 *
 * Only the collapsed reference's **default isolates** go into it. The point of
 * this pass is to find which OTUs are present at all, and one representative per
 * OTU answers that far more cheaply than every isolate would.
 */
export const createReferenceIndexStep: PathoscopeStep = {
	id: "create_reference_index",
	description: "Ensure the reference Bowtie2 index exists locally.",
	async run(context) {
		const { data, logger, proc, runSubprocess, workPath } = context;
		const paths = workPaths(workPath);

		// The FASTA is an input to `bowtie2-build` and nothing reads it again, so
		// it is staged and removed rather than left in the work path.
		const temp = await mkdtemp(join(workPath, "reference-fasta-"));
		const fastaPath = join(temp, "reference.fa");

		try {
			await createMappingIndex({
				cache: cacheFor(context),
				extraParams: REFERENCE_INDEX_EXTRA_PARAMS,
				fastaPath,
				indexKind: "reference_mapping_index",
				indexPrefix: paths.referenceIndexPrefix,
				logger,
				parentId: data.index.id,
				prepareFasta: () =>
					writeDefaultIsolateFasta({
						fastaPath,
						indexId: data.index.id,
						indexPath: paths.collapsedReference,
						logger,
					}),
				proc,
				runSubprocess,
				workflow: WORKFLOW_NAME,
				workflowVersion: APP_VERSION,
			});
		} finally {
			await rm(temp, { force: true, recursive: true });
		}
	},
};

/**
 * Write the collapsed reference's default isolates as one FASTA.
 *
 * Handed to {@link createMappingIndex} as a producer rather than run before it:
 * the `reference_mapping_index` namespace is shared with Python, so a hit is the
 * common outcome and the whole collapsed reference would be scanned into a file
 * nothing then reads.
 */
async function writeDefaultIsolateFasta({
	fastaPath,
	indexId,
	indexPath,
	logger,
}: {
	fastaPath: string;
	indexId: number;
	indexPath: string;
	logger: Logger;
}): Promise<void> {
	const source = openWorkflowIndex({ id: indexId, path: indexPath });

	try {
		// Streamed from SQLite straight to disk. The sequence order is the index
		// reader's, which decides the FASTA order and so every SAM line mapped
		// against the built index.
		await writeFasta(fastaPath, source.iterDefaultSequences());
	} finally {
		source.close();
	}

	logger.info({ fastaPath }, "assembled default reference fasta");
}

/**
 * Build one bowtie2 index per subtraction.
 *
 * The gzipped FASTA is handed to `bowtie2-build` directly — it reads gzip — so
 * unlike NuVs there is nothing to decompress first.
 *
 * The genome is downloaded here rather than with the run's other inputs, and
 * only once the cache has missed. The `subtraction_mapping_index` namespace is
 * shared with Python, so a hit is the common outcome, and a host genome is
 * gigabytes that would otherwise be pulled out of storage and never opened.
 */
export const createSubtractionIndexStep: PathoscopeStep = {
	id: "create_subtraction_index",
	description: "Ensure subtraction Bowtie2 indexes exist locally.",
	async run(context) {
		const { data, logger, proc, runSubprocess, storage, workPath } = context;
		const paths = workPaths(workPath);
		const cache = cacheFor(context);

		// Sequentially, not concurrently: `bowtie2-build --threads {proc}` is
		// already using every core, so overlapping two of them only contends.
		for (const subtraction of data.subtractions) {
			await createMappingIndex({
				cache,
				fastaPath: subtraction.path,
				indexKind: "subtraction_mapping_index",
				indexPrefix: paths.subtraction(subtraction.id).indexPrefix,
				logger,
				parentId: subtraction.id,
				prepareFasta: () =>
					downloadSubtractionFasta({
						fastaPath: subtraction.path,
						logger,
						storage,
						storageKey: subtraction.storageKey,
						subtractionId: subtraction.id,
					}),
				proc,
				runSubprocess,
				workflow: WORKFLOW_NAME,
				workflowVersion: APP_VERSION,
			});
		}
	},
};

/** Stream a subtraction's gzipped genome out of storage and onto the work path. */
async function downloadSubtractionFasta({
	fastaPath,
	logger,
	storage,
	storageKey,
	subtractionId,
}: {
	fastaPath: string;
	logger: Logger;
	storage: BuildContextInput["storage"];
	storageKey: string;
	subtractionId: number;
}): Promise<void> {
	await downloadToPath(storage, storageKey, fastaPath);

	logger.info({ fastaPath, subtractionId }, "downloaded subtraction genome");
}
