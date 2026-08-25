import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createIndexArtifact, type IndexOtu } from "@virtool/sqlite";
import {
	buildMappingIndexCacheParams,
	type CacheParams,
	createWorkflowCache,
	deriveCacheKey,
	type RunSubprocess,
	type RunSubprocessOptions,
} from "@virtool/workflow";
import {
	createFakeContext,
	createFakeJobsApiClient,
	createFakeSubprocessRunner,
	createJobsApiState,
	createRecordingLogger,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildReferenceIndexExtraParams, WORKFLOW_NAME } from "../cacheParams";
import type { PathoscopeData } from "../context";
import { workPaths } from "../paths";
import type { PathoscopeState } from "../state";
import { APP_VERSION } from "../version";
import {
	createRepresentativeIndexStep,
	createSubtractionIndexStep,
} from "./createIndexes";

const BOWTIE2_BUILD = "bowtie2-build";
const BOWTIE2_BUILD_VERSION = "2.4.4";
const CD_HIT_EST_VERSION = "4.8.1";
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
					sequence: "ACGTACGTACGT",
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
					sequence: "TTTTTTTTTTTT",
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
		extra: buildReferenceIndexExtraParams(CD_HIT_EST_VERSION),
		indexKind: "reference_mapping_index",
		parentId: INDEX_ID,
		toolVersion: BOWTIE2_BUILD_VERSION,
		workflow: WORKFLOW_NAME,
		workflowVersion: APP_VERSION,
	});
}

function subtractionIndexCacheParams(): CacheParams {
	return buildMappingIndexCacheParams({
		indexKind: "subtraction_mapping_index",
		parentId: SUBTRACTION_ID,
		toolVersion: BOWTIE2_BUILD_VERSION,
		workflow: WORKFLOW_NAME,
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
	const recordingLogger = createRecordingLogger();

	const runner = createFakeSubprocessRunner();

	runner.register([BOWTIE2_BUILD, "--version"], {
		stdout: [`${BOWTIE2_BUILD} version ${BOWTIE2_BUILD_VERSION}`],
	});
	runner.register(["cd-hit-est", "-h"], {
		exitCode: 1,
		stderr: [`====== CD-HIT version ${CD_HIT_EST_VERSION} ======`],
	});

	const builtFastas: string[] = [];
	const cdHitCommands: Array<readonly string[]> = [];
	let shouldFailCdHit = false;

	const runSubprocess: RunSubprocess = async (
		options: RunSubprocessOptions,
	) => {
		const [tool, flag, , fastaPath, indexPrefix] = options.command;

		if (tool === "cd-hit-est" && flag !== "-h") {
			cdHitCommands.push(options.command);

			if (shouldFailCdHit) {
				throw new Error("cd-hit-est failed");
			}

			const input = await readFile(options.command[2] ?? "", "utf8");
			const ids = [...input.matchAll(/^>(.+)$/gm)].map(
				(match) => match[1] ?? "",
			);
			const representative = ids.at(-1) ?? "";
			const cluster = [
				">Cluster 0",
				...ids.map((id, index) =>
					id === representative
						? `${index}\t12nt, >${id}... *`
						: `${index}\t12nt, >${id}... at +/80.00%`,
				),
				"",
			].join("\n");

			await writeFile(`${options.command[4]}.clstr`, cluster);

			return {
				cancelled: false,
				command: options.command,
				durationMs: 1,
				exitCode: 0,
				signal: null,
				stderrTail: [],
			};
		}

		if (tool === BOWTIE2_BUILD && flag !== "--version") {
			builtFastas.push(await readFile(fastaPath ?? "", "utf8"));

			// The shards the real tool writes, which the cache then archives.
			await mkdir(dirname(indexPrefix ?? ""), { recursive: true });
			await writeFile(`${indexPrefix}.1.bt2`, "built shard");
		}

		return runner(options);
	};

	const pathoscopeState: PathoscopeState = {
		candidateOtuIds: [],
		subtractedCount: 0,
	};

	return {
		builtFastas,
		cdHitCommands,
		client,
		paths,
		pathoscopeState,
		recordingLogger,
		runSubprocess,
		state,
		storage,
		testStorage,
		workPath,
		failCdHit() {
			shouldFailCdHit = true;
		},

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
	const {
		client,
		paths,
		pathoscopeState,
		recordingLogger,
		runSubprocess,
		storage,
		workPath,
	} = harness;

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
			return createRepresentativeIndexStep.run(
				createFakeContext(data, pathoscopeState, {
					client,
					logger: recordingLogger.logger,
					runSubprocess,
					storage,
					workPath,
				}),
			);
		},

		/** Write the full source reference used for representative selection. */
		async writeSourceReference() {
			await mkdir(dirname(data.index.path), { recursive: true });

			await createIndexArtifact(data.index.path, null, [OTU]);
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
		recordingLogger,
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
					logger: recordingLogger.logger,
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

describe("createRepresentativeIndexStep", () => {
	it("writes the reference fasta and caches the index on a miss", async () => {
		const {
			builtFastas,
			cdHitCommands,
			paths,
			recordingLogger,
			run,
			state,
			writeSourceReference,
		} = await setup();

		await writeSourceReference();

		await run();

		expect(builtFastas).toEqual([">seq_other\nTTTTTTTTTTTT\n"]);
		expect(cdHitCommands).toHaveLength(1);
		expect(
			recordingLogger
				.records()
				.find(
					(record) => record.msg === "assembled representative reference fasta",
				),
		).toMatchObject({
			baseCount: 12,
			durationMs: expect.any(Number),
			fastaBytes: 24,
			groupCount: 1,
			representativeCount: 1,
		});

		expect(state.cacheRegistrations.map(({ key }) => key)).toEqual([
			deriveCacheKey(referenceIndexCacheParams()),
		]);

		await expect(
			readFile(`${paths.representativeIndexPrefix}.1.bt2`, "utf8"),
		).resolves.toBe("built shard");
	});

	// The source reference is deliberately absent: assembling the FASTA has to
	// open it, and `openWorkflowIndex` throws on a missing artifact. So a run that
	// restores the index cannot have scanned or clustered the reference to write a file it
	// then deletes unread.
	it("writes no reference fasta on a cache hit", async () => {
		const { builtFastas, cdHitCommands, paths, run, seedCachedIndex, state } =
			await setup();

		await seedCachedIndex();

		await run();

		expect(builtFastas).toEqual([]);
		expect(cdHitCommands).toEqual([]);
		expect(state.cacheRegistrations).toEqual([]);

		await expect(
			readFile(join(dirname(paths.representativeIndexPrefix), SHARD_NAME), "utf8"),
		).resolves.toBe("cached shard");
	});

	it("does not build or cache an index when representative preparation fails", async () => {
		const {
			builtFastas,
			failCdHit,
			run,
			state,
			workPath,
			writeSourceReference,
		} = await setup();

		await writeSourceReference();
		failCdHit();

		await expect(run()).rejects.toThrow("cd-hit-est failed");

		expect(builtFastas).toEqual([]);
		expect(state.cacheRegistrations).toEqual([]);
		expect(
			(await readdir(workPath)).filter((name) =>
				name.startsWith("reference-fasta-"),
			),
		).toEqual([]);
	});

	// The namespace is shared, so a blob can have been archived from a directory
	// named something else and unpacks beside the index rather than onto it.
	// Reported here rather than left for bowtie2 to hit as a missing index.
	it("fails when a cached blob restores outside the index directory", async () => {
		const { builtFastas, paths, run, seedCachedIndex, state, workPath } =
			await setup();

		await seedCachedIndex("reference-index");

		await expect(run()).rejects.toThrow(
			`restored to ${join(workPath, "reference-index")}, not ${dirname(paths.representativeIndexPrefix)}`,
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
