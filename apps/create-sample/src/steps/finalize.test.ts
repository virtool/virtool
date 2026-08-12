import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { FinalizeSampleRequest, Quality } from "@virtool/contracts";
import {
	checksumFile,
	createFakeContext,
	createFakeJobsApiClient,
	createFakeNewSample,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
	type JobsApiState,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { CreateSampleData } from "../context";
import { workPaths } from "../paths";
import type { CreateSampleState } from "../state";
import { finalizeStep } from "./finalize";

const SAMPLE_ID = 91;

const LEFT = "@r1\nACGTACGT\n+\nIIIIIIII\n@r2\nTTTTGGGG\n+\nIIIIIIII\n";
const RIGHT = "@r1\nTGCATGCA\n+\nIIIIIIII\n@r2\nCCCCAAAA\n+\nIIIIIIII\n";

const QUALITY: Quality = {
	bases: [[33.5, 34]],
	composition: [[25.1, 25, 24.9, 25]],
	count: 2,
	encoding: "Sanger / Illumina 1.9",
	gc: 41,
	length: [8, 8],
	sequences: [0, 2],
};

/** A run whose uploads are on disk, each gzipped or not as asked. */
async function setup(
	uploads: readonly { contents: string; gzipped: boolean }[],
) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const names = uploads.map((_, index) => `upload_${index}.fq`);
	const paths = workPaths(workPath, names);

	await Promise.all(
		paths.reads.map(async (read, index) => {
			const upload = uploads[index];

			await mkdir(dirname(read.upload), { recursive: true });
			await writeFile(
				read.upload,
				upload?.gzipped
					? gzipSync(Buffer.from(upload.contents))
					: (upload?.contents ?? ""),
			);
		}),
	);

	const state = createJobsApiState();

	state.samples.set(SAMPLE_ID, createFakeNewSample({ id: SAMPLE_ID }));

	const { storage } = createTestStorage();

	const data: CreateSampleData = {
		sampleId: SAMPLE_ID,
		sampleName: "Test",
		uploadStorageKeys: names.map((_, index) => `uploads/${index}`),
		uploadsAreGzipped: uploads.map((upload) => upload.gzipped),
		paths,
	};

	const context = createFakeContext<CreateSampleData, CreateSampleState>(
		data,
		{ quality: QUALITY },
		{ client: createFakeJobsApiClient(state), storage, workPath },
	);

	return { context, paths, state, storage };
}

/**
 * The one finalize call the run made, narrowed to a sample's.
 *
 * `FinalizeCall` is a union over the three finalizable resources, so a test
 * reading `quality` has to say which arm it expects — and asserting that is
 * worth doing anyway.
 */
function sampleFinalize(state: JobsApiState): FinalizeSampleRequest {
	const [call] = state.finalizeCalls;

	if (call?.resource !== "sample") {
		throw new Error(`expected a sample finalize, got ${call?.resource}`);
	}

	expect(call.id).toBe(SAMPLE_ID);

	return call.request;
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
	it("stores a paired sample's reads under the names the route whitelists", async () => {
		const { context, state, storage } = await setup([
			{ contents: LEFT, gzipped: true },
			{ contents: RIGHT, gzipped: true },
		]);

		await finalizeStep.run(context);

		const { files } = sampleFinalize(state);

		expect(files.map((file) => file.name)).toStrictEqual([
			"reads_1.fq.gz",
			"reads_2.fq.gz",
		]);

		await expect(readStored(storage, files[0]?.storageKey ?? "")).resolves.toBe(
			LEFT,
		);
		await expect(readStored(storage, files[1]?.storageKey ?? "")).resolves.toBe(
			RIGHT,
		);
	});

	/**
	 * The manifest carries a minted key and no size: the route measures the
	 * object it was pointed at, and records the key verbatim after checking it
	 * sits under this sample's own prefix.
	 */
	it("declares a minted key under the sample's prefix, and no size", async () => {
		const { context, state } = await setup([{ contents: LEFT, gzipped: true }]);

		await finalizeStep.run(context);

		const [file] = sampleFinalize(state).files;

		expect(file).toStrictEqual({
			kind: "sampleRead",
			name: "reads_1.fq.gz",
			storageKey: expect.stringMatching(
				new RegExp(`^samples/${SAMPLE_ID}/[0-9a-f]{32}$`),
			),
		});
	});

	it("sends the quality data unchanged", async () => {
		const { context, state } = await setup([{ contents: LEFT, gzipped: true }]);

		await finalizeStep.run(context);

		expect(sampleFinalize(state).quality).toStrictEqual(QUALITY);
	});

	/**
	 * The canonical form the sample's `quality` column holds. It is pinned by
	 * checksum rather than by shape because the key order is what a byte
	 * comparison against a Python-written row turns on, and `JSON.stringify`
	 * emits insertion order — so a reordered literal in `@virtool/bio`'s parser
	 * would change this without changing any assertion about the values.
	 */
	it("serializes the quality payload in a pinned key order", async () => {
		const { context, state } = await setup([{ contents: LEFT, gzipped: true }]);

		await finalizeStep.run(context);

		const serialized = JSON.stringify(sampleFinalize(state).quality);

		expect(serialized).toBe(
			'{"bases":[[33.5,34]],"composition":[[25.1,25,24.9,25]],"count":2,' +
				'"encoding":"Sanger / Illumina 1.9","gc":41,"length":[8,8],' +
				'"sequences":[0,2]}',
		);

		expect(createHash("sha256").update(serialized).digest("hex")).toBe(
			"67ca733393a94889f9039ae9a3736f9334240919b98e44f046194f4cb844963f",
		);
	});

	/**
	 * Almost every upload is already gzipped, and re-encoding one would mean
	 * decompressing several gigabytes to produce bytes the user already sent.
	 * The check is that the stored object is byte-identical to the upload, which
	 * a recompression would not be — `node:zlib` stamps its own header.
	 */
	it("renames an already-gzipped upload rather than re-encoding it", async () => {
		const { context, paths, state, storage } = await setup([
			{ contents: LEFT, gzipped: true },
		]);

		const uploaded = await readFile(paths.reads[0]?.upload ?? "");

		await finalizeStep.run(context);

		const [file] = sampleFinalize(state).files;

		const stored = await readStoredBytes(storage, file?.storageKey ?? "");

		expect(stored.equals(uploaded)).toBe(true);

		// Renamed, so the source path is gone.
		await expect(access(paths.reads[0]?.upload ?? "")).rejects.toThrow();
	});

	it("compresses an upload that is not gzipped", async () => {
		const { context, paths, state, storage } = await setup([
			{ contents: LEFT, gzipped: false },
		]);

		await finalizeStep.run(context);

		const [file] = sampleFinalize(state).files;

		const stored = await readStoredBytes(storage, file?.storageKey ?? "");

		// Actually gzipped, and the same content once decompressed.
		expect(stored[0]).toBe(0x1f);
		expect(stored[1]).toBe(0x8b);
		expect(gunzipSync(stored).toString()).toBe(LEFT);

		// Not a rename: the upload is still there.
		await expect(access(paths.reads[0]?.upload ?? "")).resolves.toBeUndefined();
	});

	/**
	 * Decompressed content, which is what makes a checksum comparable across
	 * compressors — the rename path keeps the user's gzip and the compress path
	 * writes `node:zlib`'s.
	 */
	it("preserves content through both paths", async () => {
		const gzippedRun = await setup([{ contents: LEFT, gzipped: true }]);
		const plainRun = await setup([{ contents: LEFT, gzipped: false }]);

		await finalizeStep.run(gzippedRun.context);
		await finalizeStep.run(plainRun.context);

		const expected = createHash("sha256").update(LEFT).digest("hex");

		await expect(
			checksumFile(gzippedRun.paths.reads[0]?.normalized ?? ""),
		).resolves.toBe(expected);
		await expect(
			checksumFile(plainRun.paths.reads[0]?.normalized ?? ""),
		).resolves.toBe(expected);
	});

	it("mints a distinct key per read", async () => {
		const { context, state } = await setup([
			{ contents: LEFT, gzipped: true },
			{ contents: RIGHT, gzipped: true },
		]);

		await finalizeStep.run(context);

		const { files } = sampleFinalize(state);

		expect(new Set(files.map((file) => file.storageKey)).size).toBe(2);
	});

	it("refuses to finalize without quality data", async () => {
		const { context } = await setup([{ contents: LEFT, gzipped: true }]);

		context.state.quality = null;

		await expect(finalizeStep.run(context)).rejects.toThrow(
			"Quality data was not parsed",
		);
	});
});
