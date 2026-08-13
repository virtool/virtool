import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Quality } from "@virtool/contracts";
import { createTestWorkPath } from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { buildQualityCommand, readQuality, reduceQuality } from "./quality";

/**
 * A blob shaped like one `quality-core` writes.
 *
 * Two cycles rather than a real read length — nothing here is testing the
 * statistics, which are the crate's and are pinned against real FastQC output
 * in `packages/quality-core/tests/fastqc.rs`.
 */
function createQuality(overrides: Partial<Quality> = {}): Quality {
	return {
		bases: [
			[36, 37, 35, 38, 33, 39],
			[34, 35, 33, 36, 31, 37],
		],
		composition: [
			[25.1, 24.9, 25, 25],
			[26, 24, 25, 25],
		],
		count: 100,
		encoding: "Sanger / Illumina 1.9",
		gc: 41,
		length: [75, 75],
		sequences: Array.from({ length: 50 }, (_, score) =>
			score === 36 ? 100 : 0,
		),
		...overrides,
	};
}

async function writeQuality(path: string, quality: Quality): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(quality));
}

describe("buildQualityCommand", () => {
	it("names the input and the results file", () => {
		expect(
			buildQualityCommand("/work/uploads/left.fq.gz", "/work/quality/1.json"),
		).toStrictEqual([
			"quality-core",
			"--input",
			"/work/uploads/left.fq.gz",
			"--output",
			"/work/quality/1.json",
		]);
	});
});

describe("readQuality", () => {
	it("reads back the blob the crate wrote", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		const outputPath = join(workPath, "quality", "1.json");
		const quality = createQuality();

		await writeQuality(outputPath, quality);

		expect(await readQuality(outputPath)).toStrictEqual(quality);
	});

	it("rejects a results file that is not there", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		await expect(readQuality(join(workPath, "missing.json"))).rejects.toThrow();
	});
});

describe("reduceQuality", () => {
	it("returns a single blob unchanged", () => {
		const quality = createQuality();

		expect(reduceQuality([quality])).toBe(quality);
	});

	it("composites a pair", () => {
		const left = createQuality();
		const right = createQuality({
			count: 120,
			gc: 43,
			length: [70, 80],
		});

		const composite = reduceQuality([left, right]);

		expect(composite.count).toBe(220);
		expect(composite.gc).toBe(42);
		expect(composite.encoding).toBe(left.encoding);
		expect(composite.length).toStrictEqual([70, 80]);
		expect(composite.bases).toHaveLength(2);
	});

	it("refuses more than two blobs", () => {
		const quality = createQuality();

		expect(() => reduceQuality([quality, quality, quality])).toThrow(
			"Expected 1 or 2 quality reports",
		);
	});

	it("refuses no blobs", () => {
		expect(() => reduceQuality([])).toThrow("Expected 1 or 2 quality reports");
	});
});
