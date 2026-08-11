import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { StorageBackend } from "@virtool/storage";
import { MemoryStorage, StorageKeyNotFoundError } from "@virtool/storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { downloadToPath, uploadFromPath } from "./transfer";

let workPath: string;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-transfer-"));
});

afterEach(async () => {
	await rm(workPath, { recursive: true, force: true });
});

async function sizeOf(path: string): Promise<number> {
	try {
		return (await stat(path)).size;
	} catch {
		return 0;
	}
}

describe("downloadToPath", () => {
	it("writes the object's bytes to the path", async () => {
		const storage = new MemoryStorage();
		await storage.write("subtractions/1/abc", toChunks("subtraction data"));

		const path = join(workPath, "subtraction.fa.gz");
		await downloadToPath(storage, "subtractions/1/abc", path);

		expect(await readFile(path, "utf8")).toBe("subtraction data");
	});

	it("creates the parent directory", async () => {
		const storage = new MemoryStorage();
		await storage.write("k", toChunks("data"));

		const path = join(workPath, "subtractions", "1", "subtraction.fa.gz");
		await downloadToPath(storage, "k", path);

		expect(await readFile(path, "utf8")).toBe("data");
	});

	it("propagates a missing key", async () => {
		await expect(
			downloadToPath(new MemoryStorage(), "absent", join(workPath, "out")),
		).rejects.toThrow(StorageKeyNotFoundError);
	});

	// The point of the whole module: a multi-gigabyte object must never be held
	// in memory. If anything buffered, the file would stay empty until the
	// backend finished and every observation below would read zero.
	it("writes each chunk to disk before the next is produced", async () => {
		const chunk = new Uint8Array(64 * 1024).fill(7);
		const path = join(workPath, "reads_1.fq.gz");
		const observed: number[] = [];

		const storage = {
			async *read(): AsyncIterable<Uint8Array> {
				for (let index = 0; index < 3; index++) {
					yield chunk;

					// Give the write stream a turn at the event loop, then record what
					// has actually landed on disk while the source is still producing.
					await delay(20);
					observed.push(await sizeOf(path));
				}
			},
		} as unknown as StorageBackend;

		await downloadToPath(storage, "k", path);

		const [first = 0, second = 0, third = 0] = observed;

		expect(first).toBeGreaterThan(0);
		expect(second).toBeGreaterThan(first);
		expect(third).toBeGreaterThan(second);
		expect(await sizeOf(path)).toBe(chunk.length * 3);
	});

	it("does not leave a partial file readable as success when the source fails", async () => {
		const path = join(workPath, "out");

		const storage = {
			async *read(): AsyncIterable<Uint8Array> {
				yield new Uint8Array([1, 2, 3]);
				throw new Error("backend died mid-stream");
			},
		} as unknown as StorageBackend;

		await expect(downloadToPath(storage, "k", path)).rejects.toThrow(
			"backend died mid-stream",
		);
	});
});

describe("uploadFromPath", () => {
	it("streams the file to the key and returns the byte count", async () => {
		const storage = new MemoryStorage();
		const path = join(workPath, "subtraction.1.bt2");
		await writeFile(path, "index shard");

		const size = await uploadFromPath(storage, "subtractions/1/abc", path);

		expect(size).toBe("index shard".length);
		expect(await storage.size("subtractions/1/abc")).toBe("index shard".length);
	});

	it("round-trips a file larger than one chunk", async () => {
		const storage = new MemoryStorage();
		const source = join(workPath, "big");
		const target = join(workPath, "big-again");
		const content = "x".repeat(5 * 1024 * 1024);

		await writeFile(source, content);
		await uploadFromPath(storage, "k", source);
		await downloadToPath(storage, "k", target);

		expect(await readFile(target, "utf8")).toBe(content);
	});

	it("rejects when the file does not exist", async () => {
		await expect(
			uploadFromPath(new MemoryStorage(), "k", join(workPath, "absent")),
		).rejects.toThrow();
	});
});

async function* toChunks(content: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(content);
}
