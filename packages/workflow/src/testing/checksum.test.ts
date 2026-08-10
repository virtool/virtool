import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { describe, expect, it, onTestFinished } from "vitest";
import { checksumDirectory, checksumFile } from "./checksum";
import { createTestWorkPath } from "./workPath";

async function workPath(): Promise<string> {
	const { path, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	return path;
}

async function gzip(source: string, target: string, level: number) {
	await pipeline(
		createReadStream(source),
		createGzip({ level }),
		createWriteStream(target),
	);
}

const CONTENT = ">seq_1\nACGTACGTACGTACGTACGT\n>seq_2\nTTTTGGGGCCCCAAAA\n";

describe("checksumFile", () => {
	// gzip embeds an mtime and varies by compressor and level, so hashing the
	// compressed bytes would fail every comparison against a Python-produced
	// fixture for reasons that have nothing to do with correctness.
	it("gives a file and its gzipped form the same digest", async () => {
		const path = await workPath();
		const plain = join(path, "reads.fa");
		const compressed = join(path, "reads.fa.gz");

		await writeFile(plain, CONTENT);
		await gzip(plain, compressed, 6);

		await expect(checksumFile(compressed)).resolves.toBe(
			await checksumFile(plain),
		);
	});

	it("gives the same digest at two different compression levels", async () => {
		const path = await workPath();
		const plain = join(path, "reads.fa");

		await writeFile(plain, CONTENT);
		await gzip(plain, join(path, "fast.gz"), 1);
		await gzip(plain, join(path, "small.gz"), 9);

		const fast = await checksumFile(join(path, "fast.gz"));
		const small = await checksumFile(join(path, "small.gz"));

		expect(fast).toBe(small);
		// The compressed bytes really did differ, so the equality above is the
		// decompression rather than gzip happening to be deterministic here.
		expect(await checksumFile(join(path, "fast.gz"))).toBe(fast);
	});

	it("separates different content", async () => {
		const path = await workPath();

		await writeFile(join(path, "a"), "one");
		await writeFile(join(path, "b"), "two");

		expect(await checksumFile(join(path, "a"))).not.toBe(
			await checksumFile(join(path, "b")),
		);
	});

	it("handles an empty file", async () => {
		const path = await workPath();

		await writeFile(join(path, "empty"), "");

		await expect(checksumFile(join(path, "empty"))).resolves.toHaveLength(64);
	});
});

describe("checksumDirectory", () => {
	it("returns every file keyed by its relative path, sorted", async () => {
		const path = await workPath();

		await mkdir(join(path, "nested"), { recursive: true });
		await writeFile(join(path, "b.txt"), "b");
		await writeFile(join(path, "a.txt"), "a");
		await writeFile(join(path, "nested", "c.txt"), "c");

		const digests = await checksumDirectory(path);

		expect(Object.keys(digests)).toEqual(["a.txt", "b.txt", "nested/c.txt"]);
		expect(digests["a.txt"]).toBe(await checksumFile(join(path, "a.txt")));
	});

	it("decompresses on the way in, so a gzipped tree matches a plain one", async () => {
		const path = await workPath();

		await mkdir(join(path, "plain"), { recursive: true });
		await mkdir(join(path, "gz"), { recursive: true });

		await writeFile(join(path, "plain", "reads"), CONTENT);
		await gzip(join(path, "plain", "reads"), join(path, "gz", "reads"), 9);

		const plain = await checksumDirectory(join(path, "plain"));
		const compressed = await checksumDirectory(join(path, "gz"));

		expect(compressed).toEqual(plain);
	});

	it("returns an empty map for an empty tree", async () => {
		const path = await workPath();

		await mkdir(join(path, "nothing"), { recursive: true });

		await expect(checksumDirectory(join(path, "nothing"))).resolves.toEqual({});
	});
});
