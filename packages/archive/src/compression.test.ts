import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	compressFile,
	DecompressedSizeLimitError,
	decompressFile,
	decompressGzipToFile,
	isGzipped,
} from "./compression";

let workPath: string;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-compression-"));
});

afterEach(async () => {
	await rm(workPath, { recursive: true, force: true });
});

describe("compressFile and decompressFile", () => {
	it("round-trips a file", async () => {
		const source = join(workPath, "reads.fq");
		const compressed = join(workPath, "reads.fq.gz");
		const restored = join(workPath, "restored.fq");

		await writeFile(source, "@read\nACGT\n+\nIIII\n");
		await compressFile(source, compressed);
		await decompressFile(compressed, restored);

		expect(await readFile(restored, "utf8")).toBe("@read\nACGT\n+\nIIII\n");
		expect(await isGzipped(compressed)).toBe(true);
	});

	// Reads files are gigabytes; a helper that only works within one chunk would
	// pass a small round-trip test and fail on everything real.
	it("round-trips a file larger than one chunk", async () => {
		const source = join(workPath, "big.fq");
		const compressed = join(workPath, "big.fq.gz");
		const restored = join(workPath, "big-restored.fq");
		const content = "ACGT".repeat(2 * 1024 * 1024);

		await writeFile(source, content);
		await compressFile(source, compressed);
		await decompressFile(compressed, restored);

		expect(await readFile(restored, "utf8")).toBe(content);
	});

	it("reads gzip written by anything else", async () => {
		const compressed = join(workPath, "external.gz");
		const restored = join(workPath, "external");

		await writeFile(compressed, gzipSync(Buffer.from("written elsewhere")));
		await decompressFile(compressed, restored);

		expect(await readFile(restored, "utf8")).toBe("written elsewhere");
	});

	it("creates the target's parent directory", async () => {
		const source = join(workPath, "reads.fq");
		await writeFile(source, "data");

		await compressFile(source, join(workPath, "nested", "deep", "reads.fq.gz"));

		expect(
			await isGzipped(join(workPath, "nested", "deep", "reads.fq.gz")),
		).toBe(true);
	});

	it("rejects a target that is not gzip", async () => {
		const source = join(workPath, "plain");
		await writeFile(source, "not gzip at all");

		await expect(
			decompressFile(source, join(workPath, "out")),
		).rejects.toThrow();
	});
});

describe("decompressGzipToFile", () => {
	it("streams a multi-chunk gzip object into its destination", async () => {
		const target = join(workPath, "nested", "snapshot.sqlite");
		const compressed = gzipSync(Buffer.from("sqlite bytes across chunks"));

		async function* chunks(): AsyncIterable<Uint8Array> {
			for (let offset = 0; offset < compressed.length; offset += 3) {
				yield compressed.subarray(offset, offset + 3);
			}
		}

		await decompressGzipToFile(chunks(), target);

		expect(await readFile(target, "utf8")).toBe("sqlite bytes across chunks");
	});

	it.each([
		["malformed", Buffer.from("not gzip")],
		["truncated", gzipSync(Buffer.from("snapshot")).subarray(0, 8)],
	])("rejects a %s gzip stream", async (_label, compressed) => {
		async function* source(): AsyncIterable<Uint8Array> {
			yield compressed;
		}

		await expect(
			decompressGzipToFile(source(), join(workPath, "out")),
		).rejects.toThrow();
	});

	it("propagates aborts", async () => {
		const controller = new AbortController();
		controller.abort();

		async function* source(): AsyncIterable<Uint8Array> {
			yield gzipSync(Buffer.from("snapshot"));
		}

		await expect(
			decompressGzipToFile(source(), join(workPath, "out"), {
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	it("rejects output beyond the decompressed-byte limit", async () => {
		async function* source(): AsyncIterable<Uint8Array> {
			yield gzipSync(Buffer.from("too many decompressed bytes"));
		}

		await expect(
			decompressGzipToFile(source(), join(workPath, "out"), {
				maxDecompressedBytes: 8,
			}),
		).rejects.toBeInstanceOf(DecompressedSizeLimitError);
	});
});

describe("isGzipped", () => {
	it("is true for a gzipped file", async () => {
		const path = join(workPath, "a.gz");
		await writeFile(path, gzipSync(Buffer.from("data")));

		expect(await isGzipped(path)).toBe(true);
	});

	it("is false for a plain file", async () => {
		const path = join(workPath, "a.fq");
		await writeFile(path, "@read\nACGT\n");

		expect(await isGzipped(path)).toBe(false);
	});

	it("is false for a file shorter than the magic number", async () => {
		const path = join(workPath, "tiny");
		await writeFile(path, Buffer.from([0x1f]));

		expect(await isGzipped(path)).toBe(false);
	});

	it("is false for an empty file", async () => {
		const path = join(workPath, "empty");
		await writeFile(path, "");

		expect(await isGzipped(path)).toBe(false);
	});

	// A truncated gzip has the magic number and nothing else. `isGzipped` reports
	// on the first two bytes only, so it says yes here — reading the whole member
	// to find out is exactly the cost this avoids.
	it("reads only the magic number, not the whole member", async () => {
		const path = join(workPath, "truncated.gz");
		await writeFile(path, Buffer.from([0x1f, 0x8b, 0x08]));

		expect(await isGzipped(path)).toBe(true);
	});
});
