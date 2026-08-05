import { beforeEach, describe, expect, it } from "vitest";
import { deleteKeys } from "./cleanup";
import type { StorageConfig } from "./config";
import { StorageKeyNotFoundError } from "./errors";
import { createStorageBackend } from "./factory";
import { S3_MIN_PART_SIZE } from "./s3";
import { collect, listAll, readText, stream, streamOf } from "./test/fixtures";
import type { StorageBackend } from "./types";

function env(key: string): string {
	const value = process.env[key];

	if (!value) {
		throw new Error(`${key} is not set — is the storage globalSetup running?`);
	}

	return value;
}

const BACKENDS: { name: string; config: StorageConfig }[] = [
	{
		name: "s3",
		config: {
			kind: "s3",
			bucket: env("VT_TEST_S3_BUCKET"),
			region: env("VT_TEST_S3_REGION"),
			endpoint: env("VT_TEST_S3_ENDPOINT"),
			accessKeyId: env("VT_TEST_S3_ACCESS_KEY_ID"),
			secretAccessKey: env("VT_TEST_S3_SECRET_ACCESS_KEY"),
		},
	},
	{
		name: "azure",
		config: {
			kind: "azure",
			account: env("VT_TEST_AZURE_ACCOUNT"),
			container: env("VT_TEST_AZURE_CONTAINER"),
			accessKey: env("VT_TEST_AZURE_KEY"),
			endpoint: env("VT_TEST_AZURE_ENDPOINT"),
		},
	},
];

// Workers share one bucket and one container, so each test owns a key prefix
// and cleans it up rather than purging everything in sight.
function testPrefix(name: string): string {
	const worker = process.env.VITEST_WORKER_ID ?? "0";

	return `test/${worker}/${name.replaceAll(/[^a-zA-Z0-9]+/g, "_")}/`;
}

// Sweeping a prefix is a test affordance only. No production path does it: rows
// record their keys, and cleanup enumerates those.
async function clearPrefix(
	storage: StorageBackend,
	prefix: string,
): Promise<void> {
	const objects = await listAll(storage, prefix);

	await deleteKeys(
		storage,
		objects.map((object) => object.key),
	);
}

describe.each(BACKENDS)("$name storage", ({ config }) => {
	let storage: StorageBackend;
	let prefix: string;

	beforeEach(async (ctx) => {
		storage = createStorageBackend(config);
		prefix = testPrefix(ctx.task.name);

		await clearPrefix(storage, prefix);

		return async () => {
			await clearPrefix(storage, prefix);
		};
	});

	it("round-trips a small object", async () => {
		const key = `${prefix}reads.fq`;

		expect(await storage.write(key, streamOf("ACGT"))).toBe(4);
		expect(await readText(storage, key)).toBe("ACGT");
		expect(await storage.size(key)).toBe(4);
	});

	it("streams an object larger than one upload part", async () => {
		const key = `${prefix}large.bin`;

		// Over a single part the S3 backend takes the multipart path, which is the
		// path every real sequencing file takes.
		const chunk = new Uint8Array(S3_MIN_PART_SIZE).fill(7);
		const tail = new Uint8Array(1024).fill(9);
		const total = chunk.byteLength + tail.byteLength;

		expect(await storage.write(key, stream(chunk, tail))).toBe(total);
		expect(await storage.size(key)).toBe(total);

		const read = await collect(storage.read(key));

		expect(read.byteLength).toBe(total);
		expect(read[0]).toBe(7);
		expect(read[total - 1]).toBe(9);
	});

	it("overwrites an existing object", async () => {
		const key = `${prefix}reads.fq`;

		await storage.write(key, streamOf("first"));
		await storage.write(key, streamOf("second"));

		expect(await readText(storage, key)).toBe("second");
		expect(await storage.size(key)).toBe(6);
	});

	it("deletes an object", async () => {
		const key = `${prefix}reads.fq`;

		await storage.write(key, streamOf("ACGT"));
		await storage.delete(key);

		await expect(storage.size(key)).rejects.toBeInstanceOf(
			StorageKeyNotFoundError,
		);
	});

	it("deletes a missing key without complaint", async () => {
		await expect(
			storage.delete(`${prefix}never-existed`),
		).resolves.toBeUndefined();
	});

	it("lists the objects under a prefix with their sizes", async () => {
		await storage.write(`${prefix}a.txt`, streamOf("aaa"));
		await storage.write(`${prefix}nested/b.txt`, streamOf("bb"));

		const objects = await listAll(storage, prefix);

		expect(objects.map((object) => object.key)).toEqual([
			`${prefix}a.txt`,
			`${prefix}nested/b.txt`,
		]);
		expect(objects.map((object) => object.size)).toEqual([3, 2]);
		expect(objects[0]?.lastModified).toBeInstanceOf(Date);
	});

	it("lists nothing for a prefix that matches no objects", async () => {
		expect(await listAll(storage, `${prefix}empty/`)).toEqual([]);
	});

	it("throws StorageKeyNotFoundError when reading a missing key", async () => {
		await expect(
			collect(storage.read(`${prefix}missing`)),
		).rejects.toBeInstanceOf(StorageKeyNotFoundError);
	});

	it("throws StorageKeyNotFoundError when sizing a missing key", async () => {
		await expect(storage.size(`${prefix}missing`)).rejects.toBeInstanceOf(
			StorageKeyNotFoundError,
		);
	});
});
