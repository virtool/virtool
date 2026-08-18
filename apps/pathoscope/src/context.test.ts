import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
	REFERENCE_SQLITE_FILE_NAME,
	REFERENCE_SQLITE_GZIP_FILE_NAME,
} from "@virtool/sqlite";
import {
	createFakeAnalysis,
	createFakeBuildContextInput,
	createFakeIndex,
	createFakeJobsApiClient,
	createFakeRunJob,
	createFakeSample,
	createFakeSubtraction,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildPathoscopeContext } from "./context";

const ANALYSIS_ID = 11;
const INDEX_ID = 22;
const SAMPLE_ID = 33;
const SUBTRACTION_ID = 44;

/** A key no seeding helper ever mints, so storage genuinely holds nothing at it. */
const MISSING_KEY = `subtractions/${SUBTRACTION_ID}/absent`;

/**
 * A jobs API and a bucket holding everything one pathoscope run reads.
 *
 * Every seeding helper mints its own key and hands it back; the fake rows carry
 * those keys, and reading them back out of the metadata is the code's only route
 * to the bytes. A fixture that composed a key from a row id would find nothing.
 */
async function setup({ subtractions = 1 }: { subtractions?: number } = {}) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const state = createJobsApiState();
	const { storage, seedIndexArtifact, seedSampleReads, seedSubtractionFiles } =
		createTestStorage();

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
			workflow: "pathoscope",
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
		}),
	);

	const artifact = await seedIndexArtifact(
		INDEX_ID,
		REFERENCE_SQLITE_GZIP_FILE_NAME,
		gzipSync(Buffer.from("sqlite bytes")),
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

	return {
		seedIndexArtifact,
		state,
		storage,
		workPath,
		input: createFakeBuildContextInput({
			client: createFakeJobsApiClient(state),
			job: createFakeRunJob({
				workflow: "pathoscope",
				args: { analysis_id: String(ANALYSIS_ID) },
			}),
			storage,
			workPath,
		}),
	};
}

describe("buildPathoscopeContext", () => {
	it("resolves the analysis, sample, index and subtractions", async () => {
		const { input, workPath } = await setup();

		const data = await buildPathoscopeContext(input);

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

		const data = await buildPathoscopeContext(input);

		await expect(readFile(data.reads[0]?.path ?? "", "utf8")).resolves.toBe(
			"one",
		);
		await expect(readFile(data.index.path, "utf8")).resolves.toBe(
			"sqlite bytes",
		);
	});

	// The genome has one consumer, `create_subtraction_index`, which reads it only
	// on a cache miss. Its key is carried so that step can fetch it; fetching it
	// here would be gigabytes moved for a file the steady state never opens.
	it("records each subtraction genome's key without downloading it", async () => {
		const { input, storage } = await setup();

		const data = await buildPathoscopeContext(input);

		const subtraction = data.subtractions[0];

		await expect(storage.size(subtraction?.storageKey ?? "")).resolves.toBe(
			`genome ${SUBTRACTION_ID}`.length,
		);

		await expect(readFile(subtraction?.path ?? "", "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	// The genome is not transferred here, so nothing else would notice a key
	// naming no object until the step that needs it, forty minutes in.
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

		await expect(buildPathoscopeContext(input)).rejects.toThrow(MISSING_KEY);
	});

	// The two files are `reads_1.fq.gz` and `reads_2.fq.gz`, the pairing is by
	// position, and handing bowtie2 the pair the wrong way round is not something
	// it reports.
	it("orders the read paths by name", async () => {
		const { input, state } = await setup();

		const sample = state.samples.get(SAMPLE_ID);

		if (sample) {
			state.samples.set(SAMPLE_ID, {
				...sample,
				reads: [...sample.reads].reverse(),
			});
		}

		const data = await buildPathoscopeContext(input);

		expect(data.reads.map(({ path }) => path.split("/").at(-1))).toEqual([
			"reads_1.fq.gz",
			"reads_2.fq.gz",
		]);
	});

	it("handles an analysis with no subtractions", async () => {
		const { input } = await setup({ subtractions: 0 });

		await expect(buildPathoscopeContext(input)).resolves.toMatchObject({
			subtractions: [],
		});
	});

	it("resolves every subtraction of a multi-subtraction analysis", async () => {
		const { input } = await setup({ subtractions: 2 });

		const data = await buildPathoscopeContext(input);

		expect(data.subtractions.map(({ id }) => id)).toEqual([
			SUBTRACTION_ID,
			SUBTRACTION_ID + 1,
		]);
	});

	// Every arg value is a stringified id — `args` is recomposed by the jobs API
	// from the resources that reference the job, not read from a column.
	it("reads the analysis id out of a stringified job argument", async () => {
		const { input } = await setup();

		await expect(
			buildPathoscopeContext({
				...input,
				job: { ...input.job, args: { analysis_id: `${ANALYSIS_ID}` } },
			}),
		).resolves.toMatchObject({ analysisId: ANALYSIS_ID });
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
			buildPathoscopeContext({ ...input, job: { ...input.job, args } }),
		).rejects.toThrow(/analysis_id/);
	});

	// A 200–500 MB reference document exceeds V8's maximum string length, so
	// there is no JSON fallback to degrade to.
	it("refuses an index exposing only the legacy uncompressed artifact", async () => {
		const { input, state } = await setup();

		const index = state.indexes.get(INDEX_ID);

		if (index) {
			state.indexes.set(INDEX_ID, {
				...index,
				files: index.files.map((file) => ({
					...file,
					name: REFERENCE_SQLITE_FILE_NAME,
				})),
			});
		}

		await expect(buildPathoscopeContext(input)).rejects.toThrow(
			REFERENCE_SQLITE_GZIP_FILE_NAME,
		);
	});

	it("rejects a corrupt compressed index artifact", async () => {
		const { input, seedIndexArtifact, state, storage } = await setup();
		const artifact = await seedIndexArtifact(
			INDEX_ID,
			REFERENCE_SQLITE_GZIP_FILE_NAME,
			"not gzip",
		);
		const index = state.indexes.get(INDEX_ID);

		if (index) {
			state.indexes.set(INDEX_ID, {
				...index,
				files: [{ ...index.files[0], ...artifact, id: 1, type: "sqlite" }],
			});
		}

		await expect(
			buildPathoscopeContext({ ...input, storage }),
		).rejects.toThrow();
	});

	// A read name is joined into a path under `reads/` and interpolated into a
	// bash pipeline, so anything but a plain filename is refused before either.
	it.each([
		["a path separator", "../../etc/passwd"],
		["a shell metacharacter and a separator", "reads_1.fq.gz; rm -rf /"],
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

		await expect(buildPathoscopeContext(input)).rejects.toThrow(
			/plain filename/,
		);
	});

	it("refuses a subtraction with no source fasta", async () => {
		const { input, state } = await setup();

		const subtraction = state.subtractions.get(SUBTRACTION_ID);

		if (subtraction) {
			state.subtractions.set(SUBTRACTION_ID, { ...subtraction, files: [] });
		}

		await expect(buildPathoscopeContext(input)).rejects.toThrow(
			/subtraction\.fa\.gz/,
		);
	});
});
