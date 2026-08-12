import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
	createFakeContext,
	createFakeJobsApiClient,
	createFakeNewSubtraction,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { CreateSubtractionData } from "../context";
import { workPaths } from "../paths";
import { finalizeStep } from "./finalize";

const SUBTRACTION_ID = 44;

const GENOME = ">seq_1\nATGCATGCNN\n>seq_2\natgcatgcat\n";

const GC = { a: 0.25, t: 0.25, g: 0.2, c: 0.2, n: 0.1 };

/** A run whose upload is already on disk, gzipped or not. */
async function setup(gzipped: boolean) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const paths = workPaths(workPath, SUBTRACTION_ID);

	await mkdir(dirname(paths.upload), { recursive: true });
	await writeFile(
		paths.upload,
		gzipped ? gzipSync(Buffer.from(GENOME)) : GENOME,
	);

	const state = createJobsApiState();

	state.subtractions.set(
		SUBTRACTION_ID,
		createFakeNewSubtraction({ id: SUBTRACTION_ID }),
	);

	const { storage } = createTestStorage();

	const data: CreateSubtractionData = {
		subtractionId: SUBTRACTION_ID,
		subtractionName: "Arabidopsis",
		uploadStorageKey: "uploads/whatever",
		uploadIsGzipped: gzipped,
		paths,
	};

	const context = createFakeContext(
		data,
		{ count: 2, gc: GC },
		{ client: createFakeJobsApiClient(state), storage, workPath },
	);

	return { context, paths, state, storage };
}

/** The raw bytes stored under `key`. */
async function readStoredBytes(
	storage: ReturnType<typeof createTestStorage>["storage"],
	key: string,
): Promise<Buffer> {
	const chunks: Uint8Array[] = [];

	for await (const chunk of storage.read(key)) {
		chunks.push(chunk);
	}

	return Buffer.concat(chunks);
}

/** The object the manifest points at, decompressed. */
async function readStored(
	storage: ReturnType<typeof createTestStorage>["storage"],
	key: string,
): Promise<string> {
	return gunzipSync(await readStoredBytes(storage, key)).toString();
}

describe("finalizeStep", () => {
	it("finalizes with the figures and a minted key", async () => {
		const { context, state, storage } = await setup(true);

		await finalizeStep.run(context);

		expect(state.finalizeCalls).toHaveLength(1);

		const [call] = state.finalizeCalls;

		expect(call).toMatchObject({ resource: "subtraction", id: SUBTRACTION_ID });

		if (call?.resource !== "subtraction") {
			throw new Error("expected a subtraction finalize");
		}

		expect(call.request.count).toBe(2);
		expect(call.request.gc).toEqual(GC);
		expect(call.request.files).toHaveLength(1);

		const [file] = call.request.files;

		expect(file?.name).toBe("subtraction.fa.gz");
		expect(file?.kind).toBe("subtractionFile");

		// Minted, never composed — but still under the subtraction's own prefix,
		// which is what the route checks it against.
		expect(file?.storageKey).toMatch(
			new RegExp(`^subtractions/${SUBTRACTION_ID}/[0-9a-f]{32}$`),
		);

		expect(await readStored(storage, file?.storageKey ?? "")).toBe(GENOME);
	});

	// Almost every upload is already gzipped. Recompressing would mean
	// decompressing a genome and gzipping it back to produce the file the user
	// already sent.
	it("uploads an already-gzipped genome without recompressing it", async () => {
		const { context, paths, state, storage } = await setup(true);

		const original = await readFile(paths.upload);

		await finalizeStep.run(context);

		const [call] = state.finalizeCalls;

		if (call?.resource !== "subtraction") {
			throw new Error("expected a subtraction finalize");
		}

		const stored = await readStoredBytes(
			storage,
			call.request.files[0]?.storageKey ?? "",
		);

		// Byte-for-byte the upload, not a re-gzip of it: gzip embeds an mtime and
		// varies by compressor, so a recompressed object would differ here.
		expect(stored.equals(original)).toBe(true);
	});

	it("gzips a plain upload before storing it", async () => {
		const { context, state, storage } = await setup(false);

		await finalizeStep.run(context);

		const [call] = state.finalizeCalls;

		if (call?.resource !== "subtraction") {
			throw new Error("expected a subtraction finalize");
		}

		const key = call.request.files[0]?.storageKey ?? "";

		// Stored gzipped even though the upload was not, so the name is honest and
		// every reader gets the same format.
		expect(await readStored(storage, key)).toBe(GENOME);
	});
});
