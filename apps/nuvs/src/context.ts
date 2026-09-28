/**
 * Building a nuvs run's context.
 *
 * The shared analysis inputs are resolved and transferred by the runtime. The
 * HMM blobs are read only by `vfam`, the last of ten steps, so that transfer
 * belongs to the step and this side only asks storage whether each object is
 * there.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance — the open SQLite handle is made per step, from the path recorded
 * here.
 */

import type { LibraryType, WorkflowSample } from "@virtool/contracts";
import {
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	StorageKeyNotFoundError,
} from "@virtool/storage";
import {
	type AnalysisIndex,
	type AnalysisRead,
	type AnalysisSubtraction,
	type BuildContextInput,
	checkStorageKeyExists,
	fetchAnalysisMetadata,
	resolveAnalysisInputs,
	transferAnalysisInputs,
	WorkflowError,
} from "@virtool/workflow";
import { workPaths } from "./paths";

/**
 * The HMM annotations blob is not in the bucket.
 *
 * Its own class because the likely cause is neither a misconfigured bucket nor a
 * broken row, and a bare `StorageKeyNotFoundError` reads like both. The blob is
 * written by the HMM install task, so a deployment that has never installed
 * HMMs has no key to read. No jobs API route writes it, so a run cannot warm it
 * and must say why rather than fail at `vfam` forty minutes in.
 */
export class HmmAnnotationsUnavailableError extends WorkflowError {
	constructor(options?: ErrorOptions) {
		super(
			`No HMM annotations at ${HMM_ANNOTATIONS_KEY}. Virtool writes this blob lazily, on the first request for it, and clears it whenever an HMM install commits; request it once from the web API to warm it.`,
			options,
		);
	}
}

/** The sample, reduced to the three things this run branches on. */
export type NuvsSample = {
	id: number;

	/** `srna` narrows the k-mer lengths `assemble` hands SPAdes. */
	libraryType: LibraryType;

	/**
	 * The longest read observed when the sample was created, which decides the
	 * minimum length skewer will keep.
	 *
	 * Resolved here rather than at `trim_reads` because it comes off nullable
	 * quality data — see {@link resolveSample}.
	 */
	maxLength: number;

	paired: boolean;
};

/** The two fixed-key HMM blobs `vfam` reads. */
export type NuvsHmms = {
	annotationsKey: string;
	/** Where `vfam` downloads the gzipped annotations to. */
	annotationsPath: string;
	profilesKey: string;
	/** Where `vfam` downloads the profiles to, and `hmmpress` indexes them. */
	profilesPath: string;
};

/** The eagerly resolved data half of a nuvs run's context. */
export type NuvsData = {
	/** The analysis this run finalizes */
	analysisId: number;

	/** The two fixed-key HMM blobs */
	hmms: NuvsHmms;

	/** The reference index the analysis is pinned to */
	index: AnalysisIndex;

	/** The sample's reads, in pair order */
	reads: AnalysisRead[];

	/** The sample, reduced to what the run branches on */
	sample: NuvsSample;

	/** The subtractions to eliminate reads against, in the analysis's order */
	subtractions: AnalysisSubtraction[];
};

export async function buildNuvsContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<NuvsData> {
	const paths = workPaths(workPath);
	const metadata = await fetchAnalysisMetadata({ client, job, logger });
	const sample = resolveSample(metadata.sample);
	const inputs = resolveAnalysisInputs(metadata, paths);

	await Promise.all([
		transferAnalysisInputs(storage, inputs, logger),
		checkStorageKeyExists(storage, HMM_PROFILES_KEY),
		checkHmmAnnotationsExist(storage),
	]);

	return {
		analysisId: metadata.analysisId,
		hmms: {
			annotationsKey: HMM_ANNOTATIONS_KEY,
			annotationsPath: paths.compressedHmmAnnotations,
			profilesKey: HMM_PROFILES_KEY,
			profilesPath: paths.hmmProfiles,
		},
		index: inputs.index,
		reads: inputs.reads,
		sample,
		subtractions: inputs.subtractions,
	};
}

/** As {@link checkStorageKeyExists}, but explaining why this key is cold. */
async function checkHmmAnnotationsExist(
	storage: BuildContextInput["storage"],
): Promise<void> {
	try {
		await storage.size(HMM_ANNOTATIONS_KEY);
	} catch (err) {
		if (err instanceof StorageKeyNotFoundError) {
			throw new HmmAnnotationsUnavailableError({ cause: err });
		}

		throw err;
	}
}

/**
 * Reduce the sample to the three fields the run branches on.
 *
 * **A sample with no quality data fails here.** `max_length` is
 * `quality.length[1]`, and the column is nullable because it is empty while a
 * sample is still being created. Reading it without checking would defer the
 * failure to `trim_reads` — after the reference FASTA has been written and, on
 * a cache miss, the whole reference index built. Failing here names the cause
 * before step one.
 */
function resolveSample(sample: WorkflowSample): NuvsSample {
	const maxLength = sample.quality?.length[1];

	if (maxLength === undefined) {
		throw new Error(
			`Sample ${sample.id} has no quality data, so its maximum read length is unknown; it cannot be analysed until it is ready`,
		);
	}

	return {
		id: sample.id,
		libraryType: sample.libraryType,
		maxLength,
		paired: sample.paired,
	};
}
