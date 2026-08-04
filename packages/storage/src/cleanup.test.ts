import { describe, expect, it } from "vitest";
import { deletePrefix } from "./cleanup";
import { MemoryStorage } from "./memory";
import { failingStorage, listAll, streamOf } from "./test/fixtures";

describe("deletePrefix", () => {
	it("deletes every object under the prefix and leaves the rest", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));
		await storage.write("samples/1/quality.json", streamOf("bb"));
		await storage.write("samples/2/reads.fq", streamOf("c"));

		expect(await deletePrefix(storage, "samples/1/")).toEqual([]);

		const remaining = await listAll(storage, "samples/");

		expect(remaining.map((object) => object.key)).toEqual([
			"samples/2/reads.fq",
		]);
	});

	it("is idempotent when the prefix holds nothing", async () => {
		const storage = new MemoryStorage();

		expect(await deletePrefix(storage, "samples/1/")).toEqual([]);
	});

	it("reports the failures instead of throwing", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));
		await storage.write("samples/1/quality.json", streamOf("bb"));

		const error = new Error("delete failed");

		const failures = await deletePrefix(
			failingStorage({
				list: storage.list.bind(storage),
				delete: (key: string) =>
					key.endsWith("reads.fq")
						? Promise.reject(error)
						: storage.delete(key),
			}),
			"samples/1/",
		);

		expect(failures).toEqual([{ key: "samples/1/reads.fq", error }]);

		// The failure of one delete must not abandon the others.
		expect(await listAll(storage, "samples/1/")).toHaveLength(1);
	});

	it("reports the prefix itself when the listing fails", async () => {
		const failures = await deletePrefix(failingStorage(), "samples/1/");

		expect(failures).toEqual([
			{ key: "samples/1/", error: new Error("list failed") },
		]);
	});
});
