/**
 * Building a nuvs run's context.
 *
 * Everything a step needs is resolved once, here, before step 1: the metadata
 * reads against the jobs API, and from them the storage key and work-path
 * destination of every file the run reads. That is the eager model — Python
 * resolved fixtures lazily by parameter name, so a storage failure surfaced
 * forty minutes into a run at whichever step first touched the file. Here every
 * key is checked before any work is done.
 *
 * **Resolution is eager; transfer is not always.** The reads and the index
 * artifact are read by every run, so they are downloaded here. A subtraction's
 * genome is read only when `create_subtraction_indexes` misses its cache, and the
 * HMM blobs are read only by `vfam`, the last of ten steps — so those transfers
 * belong to their steps and this side only asks storage whether the object is
 * there.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance — the open SQLite handle is made per step, from the path recorded
 * here.
 */

import {
	type LibraryType,
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowSample,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { REFERENCE_SQLITE_FILE_NAME } from "@virtool/sqlite";
import {
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	StorageKeyNotFoundError,
} from "@virtool/storage";
import {
	type BuildContextInput,
	downloadToPath,
	WorkflowError,
} from "@virtool/workflow";
import { type NuvsPaths, workPaths } from "./paths";

/** The one subtraction file nuvs reads. */
const SUBTRACTION_FASTA_NAME = "subtraction.fa.gz";

/**
 * The HMM annotations blob is not in the bucket.
 *
 * Its own class because the likely cause is neither a misconfigured bucket nor a
 * broken row, and a bare `StorageKeyNotFoundError` reads like both. Python
 * generates this blob **lazily**, on the first
 * `GET /hmms/files/annotations.json.gz`, and deletes it again whenever an HMM
 * install commits new rows — so on a fresh install the key is simply cold. There
 * is no jobs API route to trigger that generation, so a TypeScript run cannot
 * warm it and must say why rather than fail at `vfam` forty minutes in.
 */
export class HmmAnnotationsUnavailableError extends WorkflowError {
	constructor(options?: ErrorOptions) {
		super(
			`No HMM annotations at ${HMM_ANNOTATIONS_KEY}. Virtool writes this blob lazily, on the first request for it, and clears it whenever an HMM install commits; request it once from the web API to warm it.`,
			options,
		);
	}
}

/** A subtraction, reduced to what the run actually uses. */
export type NuvsSubtraction = {
	id: number;
	name: string;
	/** The recorded key of the gzipped source genome. */
	storageKey: string;
	/** Where `create_subtraction_indexes` downloads that genome to. */
	path: string;
};

/** One of the sample's read files. */
export type NuvsRead = {
	/** The recorded key of the read file. */
	storageKey: string;
	/** Where the file was downloaded to. */
	path: string;
};

/** The reference index artifact the analysis is pinned to. */
export type NuvsIndex = {
	id: number;
	/** The recorded key of the SQLite artifact. */
	storageKey: string;
	/** Where the artifact was downloaded to. */
	path: string;
};

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
	index: NuvsIndex;

	/** The sample's reads, in pair order */
	reads: NuvsRead[];

	/** The sample, reduced to what the run branches on */
	sample: NuvsSample;

	/** The subtractions to eliminate reads against, in the analysis's order */
	subtractions: NuvsSubtraction[];
};

/**
 * Read a job argument naming a resource.
 *
 * **Every arg value is a stringified id** — `args` is recomposed by the jobs API
 * from the resources that reference the job rather than read from a column, and
 * `Job.args` types it `Record<string, string>`. So this parses rather than
 * type-checks, and rejects anything `Number` would quietly accept: an empty
 * string is `0`, and a trailing-garbage id would silently address a different
 * row.
 *
 * A job pointing at no analysis cannot be run, and failing here names the
 * argument rather than producing a 404 from a metadata read.
 */
function readIdArg(args: Record<string, string>, name: string): number {
	const raw = args[name];

	if (raw === undefined || !/^[1-9]\d*$/.test(raw)) {
		throw new Error(
			`Job argument ${name} must be a positive integer id, got ${JSON.stringify(raw)}`,
		);
	}

	return Number(raw);
}

export async function buildNuvsContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<NuvsData> {
	const paths = workPaths(workPath);
	const analysisId = readIdArg(job.args, "analysis_id");

	const analysis = await client.request({
		method: "GET",
		path: `/analyses/${analysisId}`,
		schema: WorkflowAnalysis,
	});

	// The sample, index and subtraction reads are independent of each other and
	// each is a round trip to a service in the same cluster.
	const [sample, index, subtractions] = await Promise.all([
		client.request({
			method: "GET",
			path: `/samples/${analysis.sample.id}`,
			schema: WorkflowSample,
		}),
		client.request({
			method: "GET",
			path: `/indexes/${analysis.index.id}`,
			schema: WorkflowIndex,
		}),
		Promise.all(
			analysis.subtractions.map((subtraction) =>
				client.request({
					method: "GET",
					path: `/subtractions/${subtraction.id}`,
					schema: WorkflowSubtraction,
				}),
			),
		),
	]);

	logger.info(
		{
			analysisId,
			indexId: index.id,
			sampleId: sample.id,
			subtractionCount: subtractions.length,
		},
		"resolved analysis metadata",
	);

	const resolvedSample = resolveSample(sample);
	const reads = resolveReads(sample, paths);
	const resolvedIndex = resolveIndex(index, paths.sourceIndex(index.id));

	const resolvedSubtractions = subtractions.map((subtraction) =>
		resolveSubtraction(subtraction, paths.subtraction(subtraction.id).fasta),
	);

	await Promise.all([
		...reads.map((read) => downloadToPath(storage, read.storageKey, read.path)),
		downloadToPath(storage, resolvedIndex.storageKey, resolvedIndex.path),
		...resolvedSubtractions.map((subtraction) =>
			checkStorageKeyExists(storage, subtraction.storageKey),
		),
		checkStorageKeyExists(storage, HMM_PROFILES_KEY),
		checkHmmAnnotationsExist(storage),
	]);

	logger.info(
		{ readCount: reads.length, indexPath: resolvedIndex.path },
		"downloaded run inputs",
	);

	return {
		analysisId,
		hmms: {
			annotationsKey: HMM_ANNOTATIONS_KEY,
			annotationsPath: paths.compressedHmmAnnotations,
			profilesKey: HMM_PROFILES_KEY,
			profilesPath: paths.hmmProfiles,
		},
		index: resolvedIndex,
		reads,
		sample: resolvedSample,
		subtractions: resolvedSubtractions,
	};
}

/**
 * Fail now if `key` names no object.
 *
 * A `size` is one metadata request and moves no bytes, which is what lets a file
 * whose transfer is deferred to the step that reads it still fail before step 1.
 * A missing key surfaces as `StorageKeyNotFoundError` naming the key.
 */
async function checkStorageKeyExists(
	storage: BuildContextInput["storage"],
	key: string,
): Promise<void> {
	await storage.size(key);
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
 * sample is still being created. Python reads it anyway and compares `None` with
 * an `int`, so an analysis of an unready sample dies with a `TypeError` inside
 * `trim_reads` — after the reference FASTA has been written and, on a cache miss,
 * the whole reference index built. This is the same failure, named, before step
 * one.
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

/**
 * Each of the sample's read files, in pair order.
 *
 * Sorted by name rather than taken in the order the read arrived in: the two
 * files are `reads_1.fq.gz` and `reads_2.fq.gz`, the pairing is by position, and
 * handing bowtie2 the pair the wrong way round is not something it reports.
 */
function resolveReads(sample: WorkflowSample, paths: NuvsPaths): NuvsRead[] {
	const names = sample.reads.map((read) => read.name);

	for (const name of names) {
		checkReadName(name);
	}

	const byName = new Map(sample.reads.map((read) => [read.name, read]));

	return names.sort().map((name) => {
		const read = byName.get(name);

		// Nullable wherever its column is, and there is no fallback that finds the
		// object — nothing composes a key from row identity on either side.
		if (!read?.storageKey) {
			throw new Error(
				`Sample ${sample.id} read ${name} records no storage key`,
			);
		}

		return { storageKey: read.storageKey, path: paths.read(name) };
	});
}

/**
 * Refuse a read name that is not a plain filename.
 *
 * The name comes off the sample's row, and this is the point it becomes a path
 * under `reads/`. A name carrying a separator writes outside the work path, so
 * it is rejected here rather than left for every later step to be careful about.
 */
function checkReadName(name: string): void {
	if (
		name === "" ||
		name === "." ||
		name === ".." ||
		name.includes("/") ||
		name.includes("\0")
	) {
		throw new Error(
			`Sample read name must be a plain filename, got ${JSON.stringify(name)}`,
		);
	}
}

/**
 * Locate the index's SQLite artifact.
 *
 * There is no fallback to the JSON forms Python still reads. A 200–500 MB
 * reference document exceeds V8's maximum string length, so `JSON.parse` cannot
 * open one at all — an index without a SQLite artifact is not analysable here
 * and must say so rather than degrade.
 */
function resolveIndex(index: WorkflowIndex, path: string): NuvsIndex {
	const file = index.files.find(
		({ name }) => name === REFERENCE_SQLITE_FILE_NAME,
	);

	if (!file) {
		throw new Error(
			`Index ${index.id} has no ${REFERENCE_SQLITE_FILE_NAME}; rebuild it before analysing against it`,
		);
	}

	return { id: index.id, storageKey: file.storageKey, path };
}

/**
 * Locate a subtraction's gzipped source genome, and only that.
 *
 * Python downloads every file a subtraction has, including the six bowtie2
 * shards. NuVs reads none of them — `create_subtraction_indexes` builds its own
 * index from this FASTA — so they are six large downloads for nothing. A
 * subtraction finalized by the TypeScript `create_subtraction` workflow has no
 * shards to download in any case.
 */
function resolveSubtraction(
	subtraction: WorkflowSubtraction,
	path: string,
): NuvsSubtraction {
	const file = subtraction.files.find(
		({ name }) => name === SUBTRACTION_FASTA_NAME,
	);

	if (!file?.storageKey) {
		throw new Error(
			`Subtraction ${subtraction.id} records no ${SUBTRACTION_FASTA_NAME} storage key`,
		);
	}

	return {
		id: subtraction.id,
		name: subtraction.name,
		storageKey: file.storageKey,
		path,
	};
}
