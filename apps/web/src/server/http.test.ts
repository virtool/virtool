import {
	MemoryStorage,
	type PresignDownloadOptions,
	type StorageBackend,
} from "@virtool/storage";
import { describe, expect, it } from "vitest";
import { streamStorageObject } from "./http";

async function write(
	storage: StorageBackend,
	key: string,
	contents: string,
): Promise<void> {
	await storage.write(
		key,
		(async function* () {
			yield new TextEncoder().encode(contents);
		})(),
	);
}

describe("streamStorageObject", () => {
	describe("stream mode", () => {
		it("streams the object with download headers", async () => {
			const storage = new MemoryStorage();
			await write(storage, "samples/1/reads_1.fq.gz", "hello");

			const response = await streamStorageObject(
				storage,
				"samples/1/reads_1.fq.gz",
				"reads_1.fq.gz",
				"application/gzip",
				"stream",
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-disposition")).toBe(
				'attachment; filename="reads_1.fq.gz"',
			);
			expect(response.headers.get("content-length")).toBe("5");
			expect(response.headers.get("content-type")).toBe("application/gzip");
			expect(await response.text()).toBe("hello");
		});

		it("returns a 404 when the object has no bytes", async () => {
			const response = await streamStorageObject(
				new MemoryStorage(),
				"missing",
				"reads_1.fq.gz",
				"application/gzip",
				"stream",
			);

			expect(response.status).toBe(404);
		});
	});

	describe("redirect mode", () => {
		it("302s to a presigned URL carrying the download's name and type", async () => {
			let call: { key: string; options: PresignDownloadOptions } | undefined;

			const storage: StorageBackend = Object.assign(new MemoryStorage(), {
				async presignDownload(key: string, options: PresignDownloadOptions) {
					call = { key, options };
					return `https://files.test/${key}?sig=abc`;
				},
			});

			const response = await streamStorageObject(
				storage,
				"samples/1/reads_1.fq.gz",
				"reads 1.fq.gz",
				"application/gzip",
				"redirect",
			);

			expect(response.status).toBe(302);
			expect(response.headers.get("location")).toBe(
				"https://files.test/samples/1/reads_1.fq.gz?sig=abc",
			);
			expect(call?.key).toBe("samples/1/reads_1.fq.gz");
			// The name and type ride in the URL because a cross-origin `<a download>`
			// is ignored — the browser takes them from the storage response.
			expect(call?.options.contentDisposition).toBe(
				"attachment; filename=\"reads_1.fq.gz\"; filename*=UTF-8''reads%201.fq.gz",
			);
			expect(call?.options.contentType).toBe("application/gzip");
			expect(call?.options.expiresIn).toBeGreaterThan(0);
		});

		it("falls back to streaming when the backend cannot presign", async () => {
			const storage = new MemoryStorage();
			await write(storage, "samples/1/reads_1.fq.gz", "hello");

			const response = await streamStorageObject(
				storage,
				"samples/1/reads_1.fq.gz",
				"reads_1.fq.gz",
				"application/gzip",
				"redirect",
			);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("hello");
		});
	});
});
