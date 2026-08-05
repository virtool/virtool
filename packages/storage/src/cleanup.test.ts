import { describe, expect, it } from "vitest";
import { deleteKeys } from "./cleanup";
import { MemoryStorage } from "./memory";
import { failingStorage, listAll, streamOf } from "./test/fixtures";

describe("deleteKeys", () => {
	it("deletes every named object and leaves the rest", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));
		await storage.write("samples/1/quality.json", streamOf("bb"));
		await storage.write("samples/2/reads.fq", streamOf("c"));

		expect(
			await deleteKeys(storage, [
				"samples/1/reads.fq",
				"samples/1/quality.json",
			]),
		).toEqual([]);

		const remaining = await listAll(storage, "samples/");

		expect(remaining.map((object) => object.key)).toEqual([
			"samples/2/reads.fq",
		]);
	});

	it("is idempotent when there are no keys", async () => {
		const storage = new MemoryStorage();

		expect(await deleteKeys(storage, [])).toEqual([]);
	});

	it("reports the failures instead of throwing", async () => {
		const storage = new MemoryStorage();

		await storage.write("samples/1/reads.fq", streamOf("aaa"));
		await storage.write("samples/1/quality.json", streamOf("bb"));

		const error = new Error("delete failed");

		const failures = await deleteKeys(
			failingStorage({
				delete: (key: string) =>
					key.endsWith("reads.fq")
						? Promise.reject(error)
						: storage.delete(key),
			}),
			["samples/1/reads.fq", "samples/1/quality.json"],
		);

		expect(failures).toEqual([{ key: "samples/1/reads.fq", error }]);

		// The failure of one delete must not abandon the others.
		expect(await listAll(storage, "samples/1/")).toHaveLength(1);
	});
});
