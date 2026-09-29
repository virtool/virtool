import {
	cacheFor,
	createMappingIndex,
	downloadToPath,
} from "@virtool/workflow";
import {
	REFERENCE_INDEX_EXTRA_PARAMS,
	REFERENCE_INDEX_KIND,
	SUBTRACTION_INDEX_EXTRA_PARAMS,
	SUBTRACTION_INDEX_KIND,
	WORKFLOW_NAME,
} from "../cacheParams";
import { workPaths } from "../paths";
import { APP_VERSION } from "../version";
import type { NuvsStep } from "./types";

/**
 * Build the bowtie2 index the OTU elimination pass maps against.
 *
 * The FASTA `create_reference_fasta` already wrote is handed straight to
 * `bowtie2-build`, so `prepareFasta` has nothing to do — unlike pathoscope,
 * where producing the FASTA is deferred into this callback precisely so a cache
 * hit never scans the reference. Here the previous step has scanned it either
 * way.
 */
export const createReferenceIndexStep: NuvsStep = {
	id: "create_reference_index",
	name: "Create reference index",
	description: "Ensure the reference Bowtie2 index exists locally.",
	async run(context) {
		const { data, logger, proc, runSubprocess, workPath } = context;
		const paths = workPaths(workPath);

		await createMappingIndex({
			cache: cacheFor(context),
			extraParams: REFERENCE_INDEX_EXTRA_PARAMS,
			fastaPath: paths.referenceFasta,
			indexKind: REFERENCE_INDEX_KIND,
			indexPrefix: paths.referenceIndexPrefix,
			logger,
			parentId: data.index.id,
			prepareFasta: () => Promise.resolve(),
			proc,
			runSubprocess,
			workflow: WORKFLOW_NAME,
			workflowVersion: APP_VERSION,
		});
	},
};

/**
 * Build one bowtie2 index per subtraction.
 *
 * The gzipped genome is handed to `bowtie2-build` directly, which reads gzip.
 *
 * The download is deferred until the cache has missed. Every analysis against
 * the same subtraction reuses one cached index, so a hit is the common outcome,
 * and a host genome is gigabytes that would otherwise be pulled out of storage
 * and never opened.
 */
export const createSubtractionIndexesStep: NuvsStep = {
	id: "create_subtraction_indexes",
	name: "Create subtraction indexes",
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
				extraParams: SUBTRACTION_INDEX_EXTRA_PARAMS,
				fastaPath: subtraction.path,
				indexKind: SUBTRACTION_INDEX_KIND,
				indexPrefix: paths.subtraction(subtraction.id).indexPrefix,
				logger,
				parentId: subtraction.id,
				prepareFasta: async () => {
					await downloadToPath(
						storage,
						subtraction.storageKey,
						subtraction.path,
					);

					logger.info(
						{ fastaPath: subtraction.path, subtractionId: subtraction.id },
						"downloaded subtraction genome",
					);
				},
				proc,
				runSubprocess,
				workflow: WORKFLOW_NAME,
				workflowVersion: APP_VERSION,
			});
		}
	},
};
