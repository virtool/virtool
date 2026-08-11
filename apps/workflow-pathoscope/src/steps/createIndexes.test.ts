import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	type CacheParams,
	createIndexArtifact,
	createWorkflowCache,
	deriveCacheKey,
	type IndexOtu,
	type RunSubprocess,
	type RunSubprocessOptions,
} from "@virtool/workflow";
import {
	createFakeContext,
	createFakeJobsApiClient,
	createFakeSubprocessRunner,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import {
	buildMappingIndexCacheParams,
	REFERENCE_INDEX_EXTRA_PARAMS,
} from "../cacheParams";
import type { PathoscopeData } from "../context";
import { workPaths } from "../paths";
import type { PathoscopeState } from "../state";
import { APP_VERSION } from "../version";
import {
	createReferenceIndexStep,
	createSubtractionIndexStep,
} from "./createIndexes";

const BOWTIE2_BUILD = "bowtie2-build";
const BOWTIE2_BUILD_VERSION = "2.4.4";
const INDEX_ID = 7;
const SHARD_NAME = "reference.1.bt2";
const SUBTRACTION_ID = 9;
const SUBTRACTION_SHARD_NAME = "subtraction.1.bt2";
const SUBTRACTION_GENOME = "genome bytes";

const OTU: IndexOtu = {
	abbreviation: "TMV",
	id: "otu_1",
	isolates: [
		{
			default: true,
			id: "isolate_default",
			sequences: [
				{
					accession: "AC_1",
					definition: "Default sequence",
					host: null,
					id: "seq_default",
					segment: null,
					sequence: "ACGTACGT",
				},
			],
			source_name: "A",
			source_type: "isolate",
		},
		{
			default: false,
			id: "isolate_other",
			sequences: [
				{
					accession: "AC_2",
					definition: "Other sequence",
					host: null,
					id: "seq_other",
					segment: null,
					sequence: "TTTT",
				},
			],
			source_name: "B",
			source_type: "isolate",
		},
	],
	name: "Tobacco mosaic virus",
	schema: [],
	taxid: 12242,
	version: 3,
};

function referenceIndexCacheParams(): CacheParams {
	return buildMappingIndexCacheParams({
		extra: REFERENCE_INDEX_EXTRA_PARAMS,
		indexKind: "reference_mapping_index",
		parentId: INDEX_ID,
		toolVersion: BOWTIE2_BUILD_VERSION,
		workflowVersion: APP_VERSION,
	});
}

function subtractionIndexCacheParams(): CacheParams {
	return buildMappingIndexCacheParams({
		indexKind: "subtraction_mapping_index",
		parentId: SUBTRACTION_ID,
		toolVersion: BOWTIE2_BUILD_VERSION,
		workflowVersion: APP_VERSION,
	});
}

/**
 * A real work path, a faked jobs API and a faked `bowtie2-build`.
 *
 * The fake tool records the FASTA it was handed **as it is called**: the
 * reference FASTA is staged in a temporary directory the step removes on the way
 * out, so its absence afterwards says nothing.
 */
async function createHarness() {
	const { path: workPath, cleanup } = await createTestWorkPath();
	onTestFinished(cleanup);

	const paths = workPaths(workPath);
	const state = createJobsApiState();
	const client = createFakeJobsApiClient(state);
	const testStorage = createTestStorage();
	const { storage } = testStorage;

	const runner = createFakeSubprocessRunner();

	runner.register([BOWTIE2_BUILD, "--version"], {
		stdout: [`${BOWTIE2_BUILD} version ${BOWTIE2_BUILD_VERSION}`],
	});

	const builtFastas: string[] = [];

	const runSubprocess: RunSubprocess = async (
		options: RunSubprocessOptions,
	) => {
		const [tool, flag, , fastaPath, indexPrefix] = options.command;

		if (tool === BOWTIE2_BUILD && flag !== "--version") {
			builtFastas.push(await readFile(fastaPath ?? "", "utf8"));

			// The shards the real tool writes, which the cache then archives.
			await mkdir(dirname(indexPrefix ?? ""), { recursive: true });
			await writeFile(`${indexPrefix}.1.bt2`, "built shard");
		}

		return runner(options);
	};

	const pathoscopeState: PathoscopeState = {
		candidateSequenceIds: [],
		subtractedCount: 0,
	};

	return {
		builtFastas,
		client,
		paths,
		pathoscopeState,
		runSubprocess,
		state,
		storage,
		testStorage,
		workPath,

		/**
		 * Register a built index under the key a run derives.
		 *
		 * Archived from outside the work path, so restoring it lands the shard
		 * where `bowtie2-build` would have written one.
		 */
		async seedCachedIndex(
			params: CacheParams,
			directoryName: string,
			shardName: string,
		) {
			const source = await mkdtemp(join(tmpdir(), "pathoscope-cache-"));
			onTestFinished(() => rm(source, { force: true, recursive: true }));

			const directory = join(source, directoryName);

			await mkdir(directory);
			await writeFile(join(directory, shardName), "cached shard");

			await createWorkflowCache({
				client,
				storage,
				stagingPath: join(source, "staging"),
			}).put(deriveCacheKey(params), directory, params);

			state.cacheRegistrations.length = 0;
		},
	};
}

async function setup() {
	const harness = await createHarness();
	const { client, paths, pathoscopeState, runSubprocess, storage, workPath } =
		harness;

	const data: PathoscopeData = {
		analysisId: 1,
		index: {
			id: INDEX_ID,
			storageKey: `indexes/${INDEX_ID}/artifact`,
			path: paths.sourceIndex(INDEX_ID),
		},
		reads: [],
		subtractions: [],
		pScoreCutoff: 0.01,
	};

	return {
		...harness,

		run() {
			return createReferenceIndexStep.run(
				createFakeContext(data, pathoscopeState, {
					client,
					runSubprocess,
					storage,
					workPath,
				}),
			);
		},

		/** Write a collapsed reference for the step to read default isolates from. */
		async writeCollapsedReference() {
			await mkdir(dirname(paths.collapsedReference), { recursive: true });

			await createIndexArtifact(paths.collapsedReference, null, [OTU]);
		},

		seedCachedIndex(directoryName = "reference_index") {
			return harness.seedCachedIndex(
				referenceIndexCacheParams(),
				directoryName,
				SHARD_NAME,
			);
		},
	};
}

/** The subtraction step over one subtraction whose genome is seeded in storage. */
async function setupSubtraction() {
	const harness = await createHarness();
	const {
		client,
		paths,
		pathoscopeState,
		runSubprocess,
		storage,
		testStorage,
		workPath,
	} = harness;

	const [genome] = await testStorage.seedSubtractionFiles(SUBTRACTION_ID, [
		{ name: "subtraction.fa.gz", contents: SUBTRACTION_GENOME },
	]);

	const fastaPath = paths.subtraction(SUBTRACTION_ID).fasta;

	const data: PathoscopeData = {
		analysisId: 1,
		index: {
			id: INDEX_ID,
			storageKey: `indexes/${INDEX_ID}/artifact`,
			path: paths.sourceIndex(INDEX_ID),
		},
		reads: [],
		subtractions: [
			{
				id: SUBTRACTION_ID,
				name: "Sub",
				storageKey: genome?.storageKey ?? "",
				path: fastaPath,
			},
		],
		pScoreCutoff: 0.01,
	};

	return {
		...harness,
		fastaPath,

		run() {
			return createSubtractionIndexStep.run(
				createFakeContext(data, pathoscopeState, {
					client,
					runSubprocess,
					storage,
					workPath,
				}),
			);
		},

		seedCachedIndex() {
			return harness.seedCachedIndex(
				subtractionIndexCacheParams(),
				String(SUBTRACTION_ID),
				SUBTRACTION_SHARD_NAME,
			);
		},
	};
}

describe("createReferenceIndexStep", () => {
	it("writes the reference fasta and caches the index on a miss", async () => {
		const { builtFastas, paths, run, state, writeCollapsedReference } =
			await setup();

		await writeCollapsedReference();

		await run();

		expect(builtFastas).toEqual([">seq_default\nACGTACGT\n"]);

		expect(state.cacheRegistrations.map(({ key }) => key)).toEqual([
			deriveCacheKey(referenceIndexCacheParams()),
		]);

		await expect(
			readFile(`${paths.referenceIndexPrefix}.1.bt2`, "utf8"),
		).resolves.toBe("built shard");
	});

	// The collapsed reference is deliberately absent: assembling the FASTA has to
	// open it, and `openWorkflowIndex` throws on a missing artifact. So a run that
	// restores the index cannot have scanned the reference to write a file it
	// then deletes unread.
	it("writes no reference fasta on a cache hit", async () => {
		const { builtFastas, paths, run, seedCachedIndex, state } = await setup();

		await seedCachedIndex();

		await run();

		expect(builtFastas).toEqual([]);
		expect(state.cacheRegistrations).toEqual([]);

		await expect(
			readFile(join(dirname(paths.referenceIndexPrefix), SHARD_NAME), "utf8"),
		).resolves.toBe("cached shard");
	});

	// The namespace is shared with Python, so a blob can have been archived from a
	// directory named something else and unpacks beside the index rather than onto
	// it. Reported here rather than left for bowtie2 to hit as a missing index.
	it("fails when a cached blob restores outside the index directory", async () => {
		const { builtFastas, paths, run, seedCachedIndex, state, workPath } =
			await setup();

		await seedCachedIndex("reference-index");

		await expect(run()).rejects.toThrow(
			`restored to ${join(workPath, "reference-index")}, not ${dirname(paths.referenceIndexPrefix)}`,
		);

		expect(builtFastas).toEqual([]);
		expect(state.cacheRegistrations).toEqual([]);
	});
});

describe("createSubtractionIndexStep", () => {
	it("downloads the genome and caches the index on a miss", async () => {
		const { builtFastas, fastaPath, paths, run, state } =
			await setupSubtraction();

		await run();

		await expect(readFile(fastaPath, "utf8")).resolves.toBe(SUBTRACTION_GENOME);
		expect(builtFastas).toEqual([SUBTRACTION_GENOME]);

		expect(state.cacheRegistrations.map(({ key }) => key)).toEqual([
			deriveCacheKey(subtractionIndexCacheParams()),
		]);

		await expect(
			readFile(
				`${paths.subtraction(SUBTRACTION_ID).indexPrefix}.1.bt2`,
				"utf8",
			),
		).resolves.toBe("built shard");
	});

	// The genome is gigabytes for a host subtraction and the shared
	// `subtraction_mapping_index` namespace makes a hit the steady state, so a run
	// that restores the index must not have pulled it out of storage at all.
	it("downloads no genome on a cache hit", async () => {
		const { builtFastas, fastaPath, paths, run, seedCachedIndex, state } =
			await setupSubtraction();

		await seedCachedIndex();

		await run();

		await expect(readFile(fastaPath, "utf8")).rejects.toThrow(/ENOENT/);
		expect(builtFastas).toEqual([]);
		expect(state.cacheRegistrations).toEqual([]);

		await expect(
			readFile(
				join(paths.subtraction(SUBTRACTION_ID).dir, SUBTRACTION_SHARD_NAME),
				"utf8",
			),
		).resolves.toBe("cached shard");
	});
});
