import { mkdtemp, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { Logger } from "@virtool/logger";
import { openWorkflowIndex, writeFasta } from "@virtool/sqlite";
import {
	type BuildContextInput,
	createMappingIndex,
	downloadToPath,
	getCdHitEstVersion,
	selectReferenceRepresentatives,
} from "@virtool/workflow";
import { cacheFor } from "../cache";
import { buildReferenceIndexExtraParams, WORKFLOW_NAME } from "../cacheParams";
import { workPaths } from "../paths";
import { APP_VERSION } from "../version";
import type { PathoscopeStep } from "./types";

/**
 * Build the bowtie2 index the candidate search maps against.
 *
 * CD-HIT-EST representatives selected from every source OTU and declared
 * segment go into it. The point of this pass is to find which OTUs are present
 * without paying to map against every source sequence.
 */
export const createRepresentativeIndexStep: PathoscopeStep = {
	id: "create_representative_index",
	name: "Prepare Screening Reference",
	description:
		"Select a small set of reference sequences for quickly finding possible viruses.",
	async run(context) {
		const { data, logger, proc, runSubprocess, workPath } = context;
		const paths = workPaths(workPath);
		const cdHitEstVersion = await getCdHitEstVersion(runSubprocess);

		// The FASTA is an input to `bowtie2-build` and nothing reads it again, so
		// it is staged and removed rather than left in the work path.
		const temp = await mkdtemp(join(workPath, "reference-fasta-"));
		const fastaPath = join(temp, "reference.fa");

		try {
			await createMappingIndex({
				cache: cacheFor(context),
				extraParams: buildReferenceIndexExtraParams(cdHitEstVersion),
				fastaPath,
				indexKind: "reference_mapping_index",
				indexPrefix: paths.representativeIndexPrefix,
				logger,
				parentId: data.index.id,
				prepareFasta: () =>
					writeRepresentativeFasta({
						fastaPath,
						indexId: data.index.id,
						indexPath: data.index.path,
						logger,
						proc,
						runSubprocess,
						scratchPath: temp,
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
 * Write source-reference CD-HIT-EST representatives as one FASTA.
 *
 * Handed to {@link createMappingIndex} as a producer rather than run before it:
 * the `reference_mapping_index` namespace is shared, so a hit is the common
 * outcome and the whole source reference would otherwise be scanned into a
 * file nothing then reads.
 */
async function writeRepresentativeFasta({
	fastaPath,
	indexId,
	indexPath,
	logger,
	proc,
	runSubprocess,
	scratchPath,
}: {
	fastaPath: string;
	indexId: number;
	indexPath: string;
	logger: Logger;
	proc: number;
	runSubprocess: BuildContextInput["runSubprocess"];
	scratchPath: string;
}): Promise<void> {
	const source = openWorkflowIndex({ id: indexId, path: indexPath });
	const partialPath = `${fastaPath}.partial`;
	const startedAt = performance.now();
	let baseCount = 0;
	let groupCount = 0;
	let representativeCount = 0;
	let previousOtuId: string | null = null;
	let previousSegment: string | null = null;
	let hasPreviousGroup = false;

	async function* tallyRepresentatives() {
		for await (const representative of selectReferenceRepresentatives({
			concurrency: proc,
			otus: source.iterOtus(),
			runSubprocess,
			scratchPath,
		})) {
			if (
				!hasPreviousGroup ||
				representative.otuId !== previousOtuId ||
				representative.groupSegment !== previousSegment
			) {
				groupCount += 1;
				previousOtuId = representative.otuId;
				previousSegment = representative.groupSegment;
				hasPreviousGroup = true;
			}

			representativeCount += 1;
			baseCount += representative.sequence.length;

			yield representative;
		}
	}

	try {
		await writeFasta(partialPath, tallyRepresentatives());
		await rename(partialPath, fastaPath);

		const { size: fastaBytes } = await stat(fastaPath);

		logger.info(
			{
				baseCount,
				durationMs: Math.round(performance.now() - startedAt),
				fastaBytes,
				groupCount,
				representativeCount,
			},
			"assembled representative reference fasta",
		);
	} finally {
		source.close();
		await rm(partialPath, { force: true });
	}
}

/**
 * Build one bowtie2 index per subtraction.
 *
 * The gzipped FASTA is handed to `bowtie2-build` directly — it reads gzip — so
 * unlike NuVs there is nothing to decompress first.
 *
 * The genome is downloaded here rather than with the run's other inputs, and
 * only once the cache has missed. The `subtraction_mapping_index` namespace is
 * shared, so a hit is the common outcome, and a host genome is gigabytes that
 * would otherwise be pulled out of storage and never opened.
 */
export const createSubtractionIndexStep: PathoscopeStep = {
	id: "create_subtraction_index",
	name: "Prepare Host References",
	description:
		"Build the search data used later to remove reads from the sample's host.",
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
