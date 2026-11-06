import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
	createFakeContext,
	createFakeSubprocessRunner,
	createTestWorkPath,
	registerFakePigz,
} from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import type { CreateSampleData, UploadFormat } from "../context";
import { workPaths } from "../paths";
import { createCreateSampleState } from "../state";
import { normalizeReadsStep } from "./normalizeReads";

const LEFT = "@r1\nACGTACGT\n+\nIIIIIIII\n";
const RIGHT = "@r1\nTGCATGCA\n+\nIIIIIIII\n";

/**
 * A run whose uploads are on disk.
 *
 * Node has no bzip2 codec, so a `bzip2` upload holds its contents as they are
 * and the fake recompression reads them as decompressed bytes.
 */
async function setup(
	uploads: readonly { contents: string; format: UploadFormat }[],
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
				upload?.format === "gzip"
					? gzipSync(Buffer.from(upload.contents))
					: (upload?.contents ?? ""),
			);
		}),
	);

	const runSubprocess = createFakeSubprocessRunner();

	registerFakePigz(runSubprocess);

	const data: CreateSampleData = {
		sampleId: 91,
		sampleName: "Test",
		uploadStorageKeys: names.map((_, index) => `uploads/${index}`),
		uploadFormats: uploads.map((upload) => upload.format),
		paths,
	};

	const context = createFakeContext(data, createCreateSampleState(), {
		runSubprocess,
		workPath,
	});

	return { context, paths, runSubprocess };
}

describe("normalizeReadsStep", () => {
	/**
	 * Almost every upload is already gzipped, and re-encoding one would mean
	 * decompressing several gigabytes to produce bytes the user already sent.
	 * The check is that the read is byte-identical to the upload, which a
	 * recompression would not be — `node:zlib` stamps its own header.
	 */
	it("renames an already-gzipped upload rather than re-encoding it", async () => {
		const { context, paths, runSubprocess } = await setup([
			{ contents: LEFT, format: "gzip" },
		]);

		const upload = paths.reads[0]?.upload ?? "";
		const uploaded = await readFile(upload);

		await normalizeReadsStep.run(context);

		const normalized = await readFile(paths.reads[0]?.normalized ?? "");

		expect(normalized.equals(uploaded)).toBe(true);
		expect(runSubprocess.calls()).toHaveLength(0);

		// Renamed, so the source path is gone.
		await expect(access(upload)).rejects.toThrow();
	});

	it("compresses a plain upload", async () => {
		const { context, paths, runSubprocess } = await setup([
			{ contents: LEFT, format: "plain" },
		]);

		await normalizeReadsStep.run(context);

		const normalized = await readFile(paths.reads[0]?.normalized ?? "");

		expect(gunzipSync(normalized).toString()).toBe(LEFT);
		expect(runSubprocess.calls()[0]?.command[0]).toBe("pigz");

		// Not a rename: the upload is still there.
		await expect(access(paths.reads[0]?.upload ?? "")).resolves.toBeUndefined();
	});

	it("converts a bzip2 upload", async () => {
		const { context, paths, runSubprocess } = await setup([
			{ contents: LEFT, format: "bzip2" },
		]);

		await normalizeReadsStep.run(context);

		const normalized = await readFile(paths.reads[0]?.normalized ?? "");

		expect(gunzipSync(normalized).toString()).toBe(LEFT);
		expect(runSubprocess.calls()[0]?.command[0]).toBe("bash");
	});

	it("keeps each read at its position when formats differ", async () => {
		const { context, paths } = await setup([
			{ contents: LEFT, format: "bzip2" },
			{ contents: RIGHT, format: "gzip" },
		]);

		await normalizeReadsStep.run(context);

		const [left, right] = await Promise.all(
			paths.reads.map((read) => readFile(read.normalized)),
		);

		expect(gunzipSync(left ?? "").toString()).toBe(LEFT);
		expect(gunzipSync(right ?? "").toString()).toBe(RIGHT);
	});

	it.each([
		["plain", "pigz"],
		["bzip2", "bash"],
	] as const)(
		"starts nothing more once a %s conversion is cancelled",
		async (format, tool) => {
			const { context, runSubprocess } = await setup([
				{ contents: LEFT, format },
				{ contents: RIGHT, format },
			]);

			runSubprocess.register((command) => command[0] === tool, {
				cancelled: true,
			});

			await normalizeReadsStep.run(context);

			expect(runSubprocess.calls()).toHaveLength(1);
		},
	);

	it("propagates a failed conversion", async () => {
		const { context, runSubprocess } = await setup([
			{ contents: LEFT, format: "bzip2" },
		]);

		runSubprocess.register((command) => command[0] === "bash", {
			exitCode: 1,
			stderr: ["lbzip2: compressed data error: bad block header magic"],
		});

		await expect(normalizeReadsStep.run(context)).rejects.toThrow(
			"bad block header magic",
		);
	});

	it("refuses a read with no recorded format", async () => {
		const { context } = await setup([{ contents: LEFT, format: "gzip" }]);

		context.data.uploadFormats = [];

		await expect(normalizeReadsStep.run(context)).rejects.toThrow(
			"No upload format recorded for read 1",
		);
	});
});
