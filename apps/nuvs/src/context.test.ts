import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY } from "@virtool/storage";
import { INDEX_SQLITE_FILE_NAME } from "@virtool/workflow";
import {
	buildTestContext,
	createFakeAnalysis,
	createFakeBuildContextInput,
	createFakeIndex,
	createFakeJobsApiClient,
	createFakeQuality,
	createFakeRunJob,
	createFakeSample,
	createFakeSubtraction,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildNuvsContext, HmmAnnotationsUnavailableError } from "./context";
import { nuvsWorkflow } from "./workflow";

const ANALYSIS_ID = 11;
const INDEX_ID = 22;
const SAMPLE_ID = 33;
const SUBTRACTION_ID = 44;

/** A key no seeding helper ever mints, so storage genuinely holds nothing at it. */
const MISSING_KEY = `subtractions/${SUBTRACTION_ID}/absent`;

/**
 * A jobs API and a bucket holding everything one nuvs run reads.
 *
 * Every seeding helper mints its own key and hands it back; the fake rows carry
 * those keys, and reading them back out of the metadata is the code's only route
 * to the bytes. A fixture that composed a key from a row id would find nothing.
 * `seedHmmFiles` is the exception, because the two HMM blobs live at fixed keys.
 */
async function setup({
	hmms = true,
	subtractions = 1,
	sample = {},
}: {
	hmms?: boolean;
	subtractions?: number;
	sample?: Partial<ReturnType<typeof createFakeSample>>;
} = {}) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const state = createJobsApiState();
	const {
		storage,
		seedHmmFiles,
		seedIndexArtifact,
		seedSampleReads,
		seedSubtractionFiles,
	} = createTestStorage();

	const subtractionIds = Array.from(
		{ length: subtractions },
		(_, index) => SUBTRACTION_ID + index,
	);

	state.analyses.set(
		ANALYSIS_ID,
		createFakeAnalysis({
			id: ANALYSIS_ID,
			index: { id: INDEX_ID, version: 3 },
			sample: { id: SAMPLE_ID, name: "Sample" },
			subtractions: subtractionIds.map((id) => ({ id, name: `Sub ${id}` })),
			workflow: "nuvs",
		}),
	);

	const reads = await seedSampleReads(SAMPLE_ID, [
		{ name: "reads_1.fq.gz", contents: "one" },
		{ name: "reads_2.fq.gz", contents: "two" },
	]);

	state.samples.set(
		SAMPLE_ID,
		createFakeSample({
			id: SAMPLE_ID,
			paired: true,
			reads: reads.map((read, index) => ({
				id: index + 1,
				name: read.name,
				size: read.size,
				storageKey: read.storageKey,
			})),
			...sample,
		}),
	);

	const artifact = await seedIndexArtifact(
		INDEX_ID,
		INDEX_SQLITE_FILE_NAME,
		"sqlite bytes",
	);

	state.indexes.set(
		INDEX_ID,
		createFakeIndex({
			id: INDEX_ID,
			files: [
				{
					id: 1,
					name: artifact.name,
					size: artifact.size,
					storageKey: artifact.storageKey,
					type: "sqlite",
				},
			],
		}),
	);

	for (const id of subtractionIds) {
		const [fasta] = await seedSubtractionFiles(id, [
			{ name: "subtraction.fa.gz", contents: `genome ${id}` },
		]);

		state.subtractions.set(
			id,
			createFakeSubtraction({
				id,
				name: `Sub ${id}`,
				files: [
					{
						id: 1,
						name: "subtraction.fa.gz",
						size: fasta?.size ?? 0,
						storageKey: fasta?.storageKey ?? "",
						type: "fasta",
					},
				],
			}),
		);
	}

	if (hmms) {
		await seedHmmFiles("profiles", "annotations");
	}

	return {
		state,
		storage,
		workPath,
		input: createFakeBuildContextInput({
			client: createFakeJobsApiClient(state),
			job: createFakeRunJob({
				workflow: "nuvs",
				args: { analysis_id: String(ANALYSIS_ID) },
			}),
			storage,
			workPath,
		}),
	};
}

describe("buildNuvsContext", () => {
	it("resolves the analysis, sample, index and subtractions", async () => {
		const { input, workPath } = await setup();

		const data = await buildNuvsContext(input);

		expect(data.analysisId).toBe(ANALYSIS_ID);
		expect(data.index.id).toBe(INDEX_ID);
		expect(data.reads.map(({ path }) => path)).toEqual([
			join(workPath, "reads", "reads_1.fq.gz"),
			join(workPath, "reads", "reads_2.fq.gz"),
		]);
		expect(data.subtractions.map(({ id }) => id)).toEqual([SUBTRACTION_ID]);
	});

	it("downloads the reads and the index artifact", async () => {
		const { input } = await setup();

		const data = await buildNuvsContext(input);

		await expect(readFile(data.reads[0]?.path ?? "", "utf8")).resolves.toBe(
			"one",
		);
		await expect(readFile(data.index.path, "utf8")).resolves.toBe(
			"sqlite bytes",
		);
	});

	// The genome has one consumer, `create_subtraction_indexes`, which reads it
	// only on a cache miss. Its key is carried so that step can fetch it; fetching
	// it here would be gigabytes moved for a file the steady state never opens.
	it("records each subtraction genome's key without downloading it", async () => {
		const { input, storage } = await setup();

		const data = await buildNuvsContext(input);

		const subtraction = data.subtractions[0];

		await expect(storage.size(subtraction?.storageKey ?? "")).resolves.toBe(
			`genome ${SUBTRACTION_ID}`.length,
		);

		await expect(readFile(subtraction?.path ?? "", "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	it("refuses a subtraction whose genome is missing from storage", async () => {
		const { input, state } = await setup();

		const subtraction = state.subtractions.get(SUBTRACTION_ID);
		const file = subtraction?.files[0];

		if (subtraction && file) {
			state.subtractions.set(SUBTRACTION_ID, {
				...subtraction,
				files: [{ ...file, storageKey: MISSING_KEY }],
			});
		}

		await expect(buildNuvsContext(input)).rejects.toThrow(MISSING_KEY);
	});

	it("orders the read paths by name", async () => {
		const { input, state } = await setup();

		const sample = state.samples.get(SAMPLE_ID);

		if (sample) {
			state.samples.set(SAMPLE_ID, {
				...sample,
				reads: [...sample.reads].reverse(),
			});
		}

		const data = await buildNuvsContext(input);

		expect(data.reads.map(({ path }) => path.split("/").at(-1))).toEqual([
			"reads_1.fq.gz",
			"reads_2.fq.gz",
		]);
	});

	it("handles an analysis with no subtractions", async () => {
		const { input } = await setup({ subtractions: 0 });

		await expect(buildNuvsContext(input)).resolves.toMatchObject({
			subtractions: [],
		});
	});

	it("resolves every subtraction of a multi-subtraction analysis", async () => {
		const { input } = await setup({ subtractions: 2 });

		const data = await buildNuvsContext(input);

		expect(data.subtractions.map(({ id }) => id)).toEqual([
			SUBTRACTION_ID,
			SUBTRACTION_ID + 1,
		]);
	});

	it.each([
		["missing", {}],
		["empty", { analysis_id: "" }],
		["not a number", { analysis_id: "abc" }],
		["zero", { analysis_id: "0" }],
		["trailing garbage", { analysis_id: "11x" }],
	])("refuses a job whose analysis_id is %s", async (_label, args) => {
		const { input } = await setup();

		await expect(
			buildNuvsContext({ ...input, job: { ...input.job, args } }),
		).rejects.toThrow(/analysis_id/);
	});

	it("refuses an index with no sqlite artifact", async () => {
		const { input, state } = await setup();

		const index = state.indexes.get(INDEX_ID);

		if (index) {
			state.indexes.set(INDEX_ID, { ...index, files: [] });
		}

		await expect(buildNuvsContext(input)).rejects.toThrow(
			INDEX_SQLITE_FILE_NAME,
		);
	});

	it.each([
		["a path separator", "../../etc/passwd"],
		["nothing", ""],
		["a parent reference", ".."],
		["a nul byte", "reads_1\0.fq.gz"],
	])("refuses a read name carrying %s", async (_label, name) => {
		const { input, state } = await setup();

		const sample = state.samples.get(SAMPLE_ID);

		if (sample) {
			state.samples.set(SAMPLE_ID, {
				...sample,
				reads: [{ id: 1, name, size: 3, storageKey: "reads/33/abc" }],
			});
		}

		await expect(buildNuvsContext(input)).rejects.toThrow(/plain filename/);
	});

	it("refuses a subtraction with no source fasta", async () => {
		const { input, state } = await setup();

		const subtraction = state.subtractions.get(SUBTRACTION_ID);

		if (subtraction) {
			state.subtractions.set(SUBTRACTION_ID, { ...subtraction, files: [] });
		}

		await expect(buildNuvsContext(input)).rejects.toThrow(
			/subtraction\.fa\.gz/,
		);
	});
});

// `max_length` is `quality.length[1]`, and the column is empty while a sample is
// still being created. Python reads it anyway and compares `None` with an `int`,
// so an unready sample dies with a `TypeError` inside `trim_reads` — after the
// reference FASTA is written and, on a cache miss, the whole reference index is
// built.
describe("the sample's maximum read length", () => {
	it("resolves it from the quality data", async () => {
		const { input } = await setup();

		const data = await buildNuvsContext(input);

		// `createFakeQuality` reports a 75–150 read-length range.
		expect(data.sample.maxLength).toBe(150);
	});

	it("refuses a sample with no quality data, before step one", async () => {
		const { input } = await setup({ sample: { quality: null } });

		await expect(buildNuvsContext(input)).rejects.toThrow(/no quality data/);
	});

	it("refuses a sample whose quality reports no upper bound", async () => {
		const { input } = await setup({
			sample: { quality: createFakeQuality({ length: [75] }) },
		});

		await expect(buildNuvsContext(input)).rejects.toThrow(/no quality data/);
	});

	it("carries the library type through, which decides the k-mer lengths", async () => {
		const { input } = await setup({ sample: { libraryType: "srna" } });

		await expect(buildNuvsContext(input)).resolves.toMatchObject({
			sample: { libraryType: "srna" },
		});
	});
});

// The blobs live at two fixed keys and are read only by `vfam`, the last of ten
// steps. Checking them here is what stops an hour of mapping and assembly ending
// at a missing file.
describe("the HMM blobs", () => {
	it("records both keys without downloading either", async () => {
		const { input } = await setup();

		const data = await buildNuvsContext(input);

		expect(data.hmms.profilesKey).toBe(HMM_PROFILES_KEY);
		expect(data.hmms.annotationsKey).toBe(HMM_ANNOTATIONS_KEY);

		await expect(readFile(data.hmms.profilesPath, "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	// Virtool generates this blob lazily, on the first request for it, and deletes
	// it whenever an HMM install commits. There is no jobs API route to trigger
	// that, so on a fresh install the key is simply cold and a run cannot warm it.
	it("names the cold annotations key rather than reporting a bare miss", async () => {
		const { input, storage } = await setup();

		await storage.delete(HMM_ANNOTATIONS_KEY);

		await expect(buildNuvsContext(input)).rejects.toThrow(
			HmmAnnotationsUnavailableError,
		);

		await expect(buildNuvsContext(input)).rejects.toThrow(
			/request it once from the web API/,
		);
	});

	it("reports a missing profiles blob by its key", async () => {
		const { input, storage } = await setup();

		await storage.delete(HMM_PROFILES_KEY);

		await expect(buildNuvsContext(input)).rejects.toThrow(HMM_PROFILES_KEY);
	});
});

// `createWorkflowContext` asserts this on every run, not only under test: the
// deferred end-to-end bed expresses a run as files plus a JSON blob, and the
// constraint rots silently the first time someone parks a handle on `data`.
describe("the run context", () => {
	it("round-trips through JSON serialization", async () => {
		const { input } = await setup({ subtractions: 2 });

		const context = await buildTestContext(nuvsWorkflow, input);

		expect(JSON.parse(JSON.stringify(context.data))).toEqual(context.data);
	});

	it("starts with no contigs", async () => {
		const { input } = await setup();

		const context = await buildTestContext(nuvsWorkflow, input);

		expect(context.state.hits).toEqual([]);
	});
});
