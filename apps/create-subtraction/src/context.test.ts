import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
	buildTestContext,
	createFakeBuildContextInput,
	createFakeJobsApiClient,
	createFakeNewSubtraction,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
	type JobsApiState,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildCreateSubtractionContext } from "./context";
import { createSubtractionWorkflow } from "./workflow";

const SUBTRACTION_ID = 44;

const GENOME = ">one\naattggccnn\n";

/**
 * A jobs API and a bucket holding the one file a create_subtraction run reads.
 *
 * `seedUpload` mints the key and hands it back; the fake row carries it, and
 * reading it back out of the metadata is the code's only route to the bytes. A
 * fixture that composed a key from the subtraction id would find nothing.
 */
async function setup(
	subtraction: Partial<ReturnType<typeof createFakeNewSubtraction>> = {},
	contents: string | Uint8Array = GENOME,
) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const state = createJobsApiState();
	const { storage, seedUpload } = createTestStorage();

	const upload = await seedUpload("genome.fa", contents);

	state.subtractions.set(
		SUBTRACTION_ID,
		createFakeNewSubtraction({
			id: SUBTRACTION_ID,
			upload: {
				id: 7,
				name: upload.name,
				size: upload.size,
				storageKey: upload.storageKey,
			},
			...subtraction,
		}),
	);

	return { state, storage, upload, workPath };
}

function inputOverrides({
	state,
	storage,
	workPath,
}: {
	state: JobsApiState;
	storage: ReturnType<typeof createTestStorage>["storage"];
	workPath: string;
}) {
	return createFakeBuildContextInput({
		client: createFakeJobsApiClient(state),
		job: {
			id: 1,
			workflow: "create_subtraction",
			args: { subtraction_id: String(SUBTRACTION_ID) },
		},
		storage,
		workPath,
	});
}

describe("buildCreateSubtractionContext", () => {
	it("resolves the subtraction and downloads its upload", async () => {
		const fixture = await setup();

		const { data } = await buildTestContext(
			createSubtractionWorkflow,
			inputOverrides(fixture),
		);

		expect(data.subtractionId).toBe(SUBTRACTION_ID);
		expect(data.uploadStorageKey).toBe(fixture.upload.storageKey);

		// Downloaded under `subtractions/{id}/`, while a gzip this run has to make
		// goes at the work-path root. Writing the second in place would truncate
		// the file being compressed.
		expect(data.paths.upload).toBe(
			join(
				fixture.workPath,
				"subtractions",
				String(SUBTRACTION_ID),
				"subtraction.fa.gz",
			),
		);
		expect(data.paths.compressedFasta).toBe(
			join(fixture.workPath, "subtraction.fa.gz"),
		);
		expect(data.paths.upload).not.toBe(data.paths.compressedFasta);

		expect(await readFile(data.paths.upload, "utf8")).toBe(GENOME);
	});

	// The name is `subtraction.fa.gz` either way, so nothing but the magic bytes
	// says which this is — and both steps branch on the answer.
	it("records whether the upload is actually gzipped", async () => {
		const plain = await setup();

		expect(
			(await buildTestContext(createSubtractionWorkflow, inputOverrides(plain)))
				.data.uploadIsGzipped,
		).toBe(false);

		const compressed = await setup({}, gzipSync(Buffer.from(GENOME)));

		expect(
			(
				await buildTestContext(
					createSubtractionWorkflow,
					inputOverrides(compressed),
				)
			).data.uploadIsGzipped,
		).toBe(true);
	});

	it("refuses a subtraction that names no upload", async () => {
		const fixture = await setup({ upload: null });

		await expect(
			buildCreateSubtractionContext(inputOverrides(fixture)),
		).rejects.toThrow(/names no upload/);
	});

	// Nullable wherever its column is, and there is no fallback that finds the
	// object — nothing composes a key from row identity on either side.
	it("refuses an upload that records no storage key", async () => {
		const fixture = await setup({
			upload: { id: 7, name: "genome.fa", size: 10, storageKey: null },
		});

		await expect(
			buildCreateSubtractionContext(inputOverrides(fixture)),
		).rejects.toThrow(/records no storage key/);
	});

	it("refuses a job whose subtraction_id argument is not an id", async () => {
		const fixture = await setup();

		await expect(
			buildCreateSubtractionContext({
				...inputOverrides(fixture),
				job: { id: 1, workflow: "create_subtraction", args: {} },
			}),
		).rejects.toThrow(/subtraction_id/);
	});
});
