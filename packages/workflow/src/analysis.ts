/**
 * Resolving the inputs of a workflow that analyses a sample.
 *
 * The analysis, its sample, its reference index and its subtractions are read
 * from the jobs API once, before step 1, and from them the storage key and
 * work-path destination of every file the run reads. Resolving eagerly means a
 * storage failure surfaces before any work is done, rather than forty minutes
 * into a run at whichever step first touched the file.
 *
 * **Resolution is eager; transfer is not always.** The reads and the index
 * artifact are read by every run, so they are downloaded here. A subtraction's
 * genome is read only when its mapping index misses the cache, so that transfer
 * belongs to the step that builds the index and this side only asks storage
 * whether the object is there.
 */

import {
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowSample,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { REFERENCE_SQLITE_GZIP_FILE_NAME } from "@virtool/sqlite";
import type { StorageBackend } from "@virtool/storage";
import { readIdArg } from "./args";
import type { BuildContextInput } from "./context";
import { downloadGzipToPath, downloadToPath } from "./files/transfer";

/** The one subtraction file an analysis reads. */
const SUBTRACTION_FASTA_NAME = "subtraction.fa.gz";

/** One of the sample's read files. */
export type AnalysisRead = {
	/** The recorded key of the read file. */
	storageKey: string;
	/** Where the file was downloaded to. */
	path: string;
};

/** The reference index artifact the analysis is pinned to. */
export type AnalysisIndex = {
	id: number;
	/** The recorded key of the gzip-encoded SQLite artifact. */
	storageKey: string;
	/** Where the artifact was stream-decompressed to raw SQLite. */
	path: string;
};

/** A subtraction, reduced to what an analysis uses. */
export type AnalysisSubtraction = {
	id: number;
	name: string;
	/** The recorded key of the gzipped source genome. */
	storageKey: string;
	/** Where the step that builds its mapping index downloads that genome to. */
	path: string;
};

/** The records an analysis job acts on, as the jobs API serves them. */
export type AnalysisMetadata = {
	analysisId: number;
	sample: WorkflowSample;
	index: WorkflowIndex;
	/** In the analysis's order. */
	subtractions: WorkflowSubtraction[];
};

/** The analysis inputs, reduced to storage keys and work-path destinations. */
export type AnalysisInputs = {
	/** The sample's reads, in pair order. */
	reads: AnalysisRead[];
	index: AnalysisIndex;
	/** In the analysis's order. */
	subtractions: AnalysisSubtraction[];
};

/** The work-path destinations of an analysis's inputs. */
export type AnalysisInputPaths = {
	read: (name: string) => string;
	sourceIndex: (indexId: number) => string;
	subtraction: (subtractionId: number) => { fasta: string };
};

/** Read the analysis named by the job's `analysis_id` and every record it references. */
export async function fetchAnalysisMetadata({
	client,
	job,
	logger,
}: Pick<
	BuildContextInput,
	"client" | "job" | "logger"
>): Promise<AnalysisMetadata> {
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

	return { analysisId, sample, index, subtractions };
}

/** Locate every file the analysis reads, and where each one goes. */
export function resolveAnalysisInputs(
	{ sample, index, subtractions }: AnalysisMetadata,
	paths: AnalysisInputPaths,
): AnalysisInputs {
	return {
		reads: resolveReads(sample, paths),
		index: resolveIndex(index, paths.sourceIndex(index.id)),
		subtractions: subtractions.map((subtraction) =>
			resolveSubtraction(subtraction, paths.subtraction(subtraction.id).fasta),
		),
	};
}

/**
 * Download the reads and the index artifact, and check each subtraction genome
 * exists without downloading it.
 */
export async function transferAnalysisInputs(
	storage: StorageBackend,
	{ reads, index, subtractions }: AnalysisInputs,
	logger: BuildContextInput["logger"],
): Promise<void> {
	await Promise.all([
		...reads.map((read) => downloadToPath(storage, read.storageKey, read.path)),
		downloadGzipToPath(storage, index.storageKey, index.path),
		...subtractions.map((subtraction) =>
			checkStorageKeyExists(storage, subtraction.storageKey),
		),
	]);

	logger.info(
		{ readCount: reads.length, indexPath: index.path },
		"downloaded run inputs",
	);
}

/**
 * Fail now if `key` names no object.
 *
 * A `size` is one metadata request and moves no bytes, which is what lets a file
 * whose transfer is deferred to the step that reads it still fail before step 1.
 * A missing key surfaces as `StorageKeyNotFoundError` naming the key.
 */
export async function checkStorageKeyExists(
	storage: StorageBackend,
	key: string,
): Promise<void> {
	await storage.size(key);
}

/**
 * Each of the sample's read files, in pair order.
 *
 * Sorted by name rather than taken in the order the read arrived in: the two
 * files are `reads_1.fq.gz` and `reads_2.fq.gz`, the pairing is by position, and
 * handing bowtie2 the pair the wrong way round is not something it reports.
 */
function resolveReads(
	sample: WorkflowSample,
	paths: AnalysisInputPaths,
): AnalysisRead[] {
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
 * under `reads/` and, in some workflows, a word in a `bash -c` string. A name
 * carrying a separator writes outside the work path, so it is rejected here
 * rather than left for every later step to be careful about.
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
 * There is no fallback to the JSON forms an older index may still carry. A
 * 200–500 MB reference document exceeds V8's maximum string length, so
 * `JSON.parse` cannot open one at all — an index without a SQLite artifact is
 * not analysable here and must say so rather than degrade.
 */
function resolveIndex(index: WorkflowIndex, path: string): AnalysisIndex {
	const file = index.files.find(
		({ name }) => name === REFERENCE_SQLITE_GZIP_FILE_NAME,
	);

	if (!file) {
		throw new Error(
			`Index ${index.id} has no ${REFERENCE_SQLITE_GZIP_FILE_NAME}; rebuild it before analysing against it`,
		);
	}

	return { id: index.id, storageKey: file.storageKey, path };
}

/**
 * Locate a subtraction's gzipped source genome, and only that.
 *
 * A subtraction row can list six bowtie2 shards alongside its genome. An
 * analysis reads none of them — it builds its own index from this FASTA — so
 * downloading them would be six large transfers for nothing. A subtraction
 * finalized by the `create_subtraction` workflow has no shards to download in
 * any case.
 */
function resolveSubtraction(
	subtraction: WorkflowSubtraction,
	path: string,
): AnalysisSubtraction {
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
