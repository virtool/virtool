import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import type { WorkflowSample } from "@virtool/contracts";
import {
	buildTestContext,
	createFakeJobsApiClient,
	createFakeNewSample,
	createFakeRunJob,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { createSampleWorkflow } from "./workflow";

const SAMPLE_ID = 91;

const LEFT = "@r1\nACGT\n+\nIIII\n";
const RIGHT = "@r1\nTGCA\n+\nIIII\n";

/**
 * A sample served by the fixture, with its uploads seeded into storage.
 *
 * The keys are the ones `seedUpload` minted, attached to the fake rows the way
 * the real jobs API attaches the recorded `storage_key`. Nothing here composes
 * a key, so a context builder that guessed one would find no object.
 */
async function setup(
	uploads: readonly { name: string; contents: string | Uint8Array }[],
	overrides: Partial<WorkflowSample> = {},
) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const testStorage = createTestStorage();

	const seeded = await Promise.all(
		uploads.map((upload) =>
			testStorage.seedUpload(upload.name, upload.contents),
		),
	);

	const state = createJobsApiState();

	state.samples.set(
		SAMPLE_ID,
		createFakeNewSample({
			id: SAMPLE_ID,
			uploads: seeded.map((file, index) => ({
				id: 500 + index,
				name: file.name,
				size: file.size,
				storageKey: file.storageKey,
			})),
			...overrides,
		}),
	);

	const client = createFakeJobsApiClient(state);

	return {
		build: () =>
			buildTestContext(createSampleWorkflow, {
				client,
				job: createFakeRunJob({
					workflow: "create_sample",
					args: { sample_id: String(SAMPLE_ID) },
				}),
				storage: testStorage.storage,
				workPath,
			}),
		seeded,
		workPath,
	};
}

describe("buildCreateSampleContext", () => {
	it("downloads a paired sample's uploads to their own names", async () => {
		const { build } = await setup([
			{ name: "left.fq", contents: LEFT },
			{ name: "right.fq", contents: RIGHT },
		]);

		const { data } = await build();

		expect(data.sampleId).toBe(SAMPLE_ID);
		expect(data.paths.reads).toHaveLength(2);

		const [left, right] = data.paths.reads;

		expect(left?.upload.endsWith("/uploads/left.fq")).toBe(true);
		expect(right?.upload.endsWith("/uploads/right.fq")).toBe(true);

		await expect(readFile(left?.upload ?? "", "utf8")).resolves.toBe(LEFT);
		await expect(readFile(right?.upload ?? "", "utf8")).resolves.toBe(RIGHT);
	});

	it("records the keys it read from, in upload order", async () => {
		const { build, seeded } = await setup([
			{ name: "left.fq", contents: LEFT },
			{ name: "right.fq", contents: RIGHT },
		]);

		const { data } = await build();

		expect(data.uploadStorageKeys).toStrictEqual(
			seeded.map((file) => file.storageKey),
		);
	});

	it("detects gzipped uploads by content, not by name", async () => {
		const { build } = await setup([
			// Named as though it were plain, but gzipped.
			{ name: "left.fq", contents: gzipSync(Buffer.from(LEFT)) },
			// Named as though it were gzipped, but plain.
			{ name: "right.fq.gz", contents: RIGHT },
		]);

		const { data } = await build();

		expect(data.uploadsAreGzipped).toStrictEqual([true, false]);
	});

	it("handles a single-read sample", async () => {
		const { build } = await setup([{ name: "only.fq.gz", contents: LEFT }]);

		const { data } = await build();

		expect(data.paths.reads).toHaveLength(1);
		expect(data.uploadStorageKeys).toHaveLength(1);
	});

	/**
	 * `getSample` derives `paired` from the reads rows, which do not exist until
	 * finalize — so a running create_sample job is always served `paired: false`
	 * and a port that branched on it would treat every sample as single-read.
	 */
	it("takes the read count from the uploads, not from paired", async () => {
		const { build } = await setup(
			[
				{ name: "left.fq", contents: LEFT },
				{ name: "right.fq", contents: RIGHT },
			],
			{ paired: false },
		);

		const { data } = await build();

		expect(data.paths.reads).toHaveLength(2);
	});

	it("refuses a sample naming no uploads", async () => {
		const { build } = await setup([], {});

		await expect(build()).rejects.toThrow("names 0 uploads");
	});

	it("refuses an upload with no recorded storage key", async () => {
		const state = createJobsApiState();
		state.samples.set(
			SAMPLE_ID,
			createFakeNewSample({
				id: SAMPLE_ID,
				uploads: [{ id: 1, name: "left.fq", size: 10, storageKey: null }],
			}),
		);

		const { path: workPath, cleanup } = await createTestWorkPath();
		onTestFinished(cleanup);

		await expect(
			buildTestContext(createSampleWorkflow, {
				client: createFakeJobsApiClient(state),
				job: createFakeRunJob({
					workflow: "create_sample",
					args: { sample_id: String(SAMPLE_ID) },
				}),
				storage: createTestStorage().storage,
				workPath,
			}),
		).rejects.toThrow("records no storage key");
	});

	/**
	 * `uploads.name` is user-supplied and is joined onto the work path. A name
	 * carrying a separator would write outside `uploads/`.
	 */
	it("refuses an upload name that is not a plain filename", async () => {
		const { build } = await setup([{ name: "../escape.fq", contents: LEFT }]);

		await expect(build()).rejects.toThrow("not a plain filename");
	});

	/**
	 * Two distinct upload rows may carry the same filename, and both would
	 * download onto one path — leaving the sample finalized with one read stored
	 * twice and nothing to say so.
	 */
	it("refuses two uploads sharing a filename", async () => {
		const { build } = await setup([
			{ name: "reads.fq", contents: LEFT },
			{ name: "reads.fq", contents: RIGHT },
		]);

		await expect(build()).rejects.toThrow("same filename");
	});

	it("refuses a job with no sample_id argument", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		await expect(
			buildTestContext(createSampleWorkflow, {
				job: createFakeRunJob({ workflow: "create_sample", args: {} }),
				workPath,
			}),
		).rejects.toThrow("must be a positive integer id");
	});
});
