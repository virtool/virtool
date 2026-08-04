import { describe, expect, it } from "vitest";
import { StorageKeyNotFoundError } from "./errors";
import { MemoryStorage } from "./memory";
import { collect, listAll, readText, stream, streamOf } from "./test/fixtures";

describe("MemoryStorage", () => {
	it("round-trips a written object and reports bytes written", async () => {
		const storage = new MemoryStorage();

		const written = await storage.write("files/a.txt", streamOf("hello"));

		expect(written).toBe(5);
		expect(await readText(storage, "files/a.txt")).toBe("hello");
		expect(await storage.size("files/a.txt")).toBe(5);
	});

	it("joins a multi-chunk write into one object", async () => {
		const storage = new MemoryStorage();
		const encoder = new TextEncoder();

		const written = await storage.write(
			"files/a.txt",
			stream(encoder.encode("abc"), encoder.encode("de")),
		);

		expect(written).toBe(5);
		expect(await collect(storage.read("files/a.txt"))).toEqual(
			encoder.encode("abcde"),
		);
	});

	it("overwrites an existing object", async () => {
		const storage = new MemoryStorage();

		await storage.write("files/a.txt", streamOf("first"));
		await storage.write("files/a.txt", streamOf("second"));

		expect(await readText(storage, "files/a.txt")).toBe("second");
	});

	it("deletes an object and tolerates a missing key", async () => {
		const storage = new MemoryStorage();

		await storage.write("files/a.txt", streamOf("hello"));
		await storage.delete("files/a.txt");

		await expect(storage.size("files/a.txt")).rejects.toBeInstanceOf(
			StorageKeyNotFoundError,
		);
		await expect(storage.delete("files/a.txt")).resolves.toBeUndefined();
	});

	it("lists only the objects under a prefix", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));
		await storage.write("samples/1/quality.json", streamOf("bb"));
		await storage.write("samples/2/reads.fq", streamOf("c"));

		const objects = await listAll(storage, "samples/1/");

		expect(objects.map((object) => object.key)).toEqual([
			"samples/1/quality.json",
			"samples/1/reads.fq",
		]);
		expect(objects.map((object) => object.size)).toEqual([2, 3]);
	});

	it("lists nothing for a prefix that matches no objects", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));

		expect(await listAll(storage, "indexes/")).toEqual([]);
	});

	it("throws StorageKeyNotFoundError when reading a missing key", async () => {
		const storage = new MemoryStorage();

		await expect(collect(storage.read("files/missing"))).rejects.toBeInstanceOf(
			StorageKeyNotFoundError,
		);
		await expect(storage.size("files/missing")).rejects.toBeInstanceOf(
			StorageKeyNotFoundError,
		);
	});
});
