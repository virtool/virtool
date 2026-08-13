import { describe, expect, it } from "vitest";
import { readsFileName, workPaths } from "./paths";

describe("readsFileName", () => {
	it("names a read by its position in the create request", () => {
		expect(readsFileName(0)).toBe("reads_1.fq.gz");
		expect(readsFileName(1)).toBe("reads_2.fq.gz");
	});
});

describe("workPaths", () => {
	it("keeps every upload under the uploads directory", () => {
		const { reads } = workPaths("/work", ["left.fq.gz", "right.fq"]);

		expect(reads.map((read) => read.upload)).toStrictEqual([
			"/work/uploads/left.fq.gz",
			"/work/uploads/right.fq",
		]);
	});

	it("names the normalized reads by position, not by upload name", () => {
		const { reads } = workPaths("/work", ["zzz.fq.gz", "aaa.fq.gz"]);

		expect(reads.map((read) => read.normalized)).toStrictEqual([
			"/work/reads/reads_1.fq.gz",
			"/work/reads/reads_2.fq.gz",
		]);
	});

	/**
	 * The collision Python has. `path.with_name("reads_1.fq.gz")` on the first
	 * upload lands on the second upload's own path, so normalizing the first
	 * destroys the second before it is read and the sample finalizes with one
	 * read stored twice.
	 */
	it("puts a normalized read out of reach of any upload name", () => {
		const { reads } = workPaths("/work", ["reads_1.fq.gz", "reads_2.fq.gz"]);

		const uploads = new Set(reads.map((read) => read.upload));

		for (const read of reads) {
			expect(uploads.has(read.normalized)).toBe(false);
		}
	});

	it("gives each read its own quality results file", () => {
		const { reads } = workPaths("/work", ["left.fq.gz", "right.fq.gz"]);

		expect(reads.map((read) => read.qualityOutput)).toStrictEqual([
			"/work/quality/1.json",
			"/work/quality/2.json",
		]);
	});

	it("handles a single-read sample", () => {
		const { reads } = workPaths("/work", ["only.fq.gz"]);

		expect(reads).toHaveLength(1);
		expect(reads[0]?.normalized).toBe("/work/reads/reads_1.fq.gz");
	});
});
