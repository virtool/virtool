/**
 * Building a pathoscope run's context.
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
 * genome is read only when `create_subtraction_index` misses its cache, which is
 * the exception rather than the steady state, so that transfer belongs to the
 * step and this side only asks storage whether the object is there.
 *
 * Every value below survives a JSON round trip. `createWorkflowContext` asserts
 * that on every run, so nothing here may be a handle, a closure, or a class
 * instance — the open SQLite handles are made per step, from the paths recorded
 * here.
 */

import {
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowSample,
	WorkflowSubtraction,
} from "@virtool/contracts";
import { REFERENCE_SQLITE_FILE_NAME } from "@virtool/sqlite";
import { type BuildContextInput, downloadToPath } from "@virtool/workflow";
import { type PathoscopePaths, workPaths } from "./paths";

/**
 * The minimum alignment score an alignment must reach to be counted.
 *
 * Python's `p_score_cutoff` fixture, which nothing ever overrode.
 */
export const P_SCORE_CUTOFF = 0.01;

/** The one subtraction file pathoscope reads. */
const SUBTRACTION_FASTA_NAME = "subtraction.fa.gz";

/** A subtraction, reduced to what the run actually uses. */
export type PathoscopeSubtraction = {
	id: number;
	name: string;
	/** The recorded key of the gzipped source genome. */
	storageKey: string;
	/** Where `create_subtraction_index` downloads that genome to. */
	path: string;
};

/** One of the sample's read files. */
export type PathoscopeRead = {
	/** The recorded key of the read file. */
	storageKey: string;
	/** Where the file was downloaded to. */
	path: string;
};

/** The reference index artifact the analysis is pinned to. */
export type PathoscopeIndex = {
	id: number;
	/** The recorded key of the SQLite artifact. */
	storageKey: string;
	/** Where the artifact was downloaded to. */
	path: string;
};

/** The eagerly resolved data half of a pathoscope run's context. */
export type PathoscopeData = {
	/** The analysis this run finalizes */
	analysisId: number;

	/** The reference index the analysis is pinned to */
	index: PathoscopeIndex;

	/** The sample's reads, in pair order */
	reads: PathoscopeRead[];

	/** The subtractions to eliminate reads against, in the analysis's order */
	subtractions: PathoscopeSubtraction[];

	/** @see {@link P_SCORE_CUTOFF} */
	pScoreCutoff: number;
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

export async function buildPathoscopeContext({
	client,
	job,
	logger,
	storage,
	workPath,
}: BuildContextInput): Promise<PathoscopeData> {
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
	]);

	logger.info(
		{ readCount: reads.length, indexPath: resolvedIndex.path },
		"downloaded run inputs",
	);

	return {
		analysisId,
		index: resolvedIndex,
		reads,
		pScoreCutoff: P_SCORE_CUTOFF,
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

/**
 * Each of the sample's read files, in pair order.
 *
 * Sorted by name rather than taken in the order the read arrived in: the two
 * files are `reads_1.fq.gz` and `reads_2.fq.gz`, the pairing is by position, and
 * handing bowtie2 the pair the wrong way round is not something it reports.
 */
function resolveReads(
	sample: WorkflowSample,
	paths: PathoscopePaths,
): PathoscopeRead[] {
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
 * The name comes off the sample's row, and this is the point it becomes both a
 * path under `reads/` and a word in a `bash -c` string. A name carrying a
 * separator writes outside the work path, so it is rejected here rather than
 * left for every later step to be careful about.
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
function resolveIndex(index: WorkflowIndex, path: string): PathoscopeIndex {
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
 * shards. Pathoscope reads none of them — `create_subtraction_index` builds its
 * own index from this FASTA — so they are six large downloads for nothing. A
 * subtraction finalized by the TypeScript `create_subtraction` workflow has no
 * shards to download in any case.
 */
function resolveSubtraction(
	subtraction: WorkflowSubtraction,
	path: string,
): PathoscopeSubtraction {
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
