import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { writeGzipped } from "./compression.testing";
import { fastq, parseFastqIds, setupStep } from "./fixtures";
import { reunitePairsStep } from "./reunitePairs";

/**
 * Seed the trimmed pair and the reads that survived elimination.
 *
 * The trimmed files are gzipped, as skewer left them — this step gunzips in the
 * stream rather than writing decompressed copies of both, which Python does.
 */
async function runStep({
	paired = true,
	survivors = ["r1", "r3"],
	left = ["r1", "r2", "r3"],
	right = ["r1", "r2", "r3"],
}: {
	paired?: boolean;
	survivors?: string[];
	left?: string[];
	right?: string[];
} = {}) {
	const setup = await setupStep({ paired });

	await mkdir(setup.paths.trimmedDir, { recursive: true });

	await writeFile(setup.paths.unmappedSubtractions, fastq(...survivors));
	await writeGzipped(setup.paths.trimmedRead(1), fastq(...left));
	await writeGzipped(setup.paths.trimmedRead(2), fastq(...right));

	await reunitePairsStep.run(setup.context);

	return setup;
}

describe("reunitePairsStep", () => {
	it("keeps only the reads that survived elimination, in both files", async () => {
		const { paths } = await runStep({ survivors: ["r1", "r3"] });

		expect(
			parseFastqIds(await readFile(paths.unmappedPair(1), "utf8")),
		).toEqual(["r1", "r3"]);

		expect(
			parseFastqIds(await readFile(paths.unmappedPair(2), "utf8")),
		).toEqual(["r1", "r3"]);
	});

	// The elimination passes ran over both mates as unpaired reads, so one mate
	// can survive where the other did not. SPAdes wants two files whose records
	// correspond, so a read whose mate is gone has to go from both.
	it("drops a read from the left file when only the right mate survived", async () => {
		const { paths } = await runStep({
			left: ["r1", "r2"],
			right: ["r2", "r3"],
			survivors: ["r2", "r3"],
		});

		expect(
			parseFastqIds(await readFile(paths.unmappedPair(1), "utf8")),
		).toEqual(["r2"]);

		expect(
			parseFastqIds(await readFile(paths.unmappedPair(2), "utf8")),
		).toEqual(["r2", "r3"]);
	});

	it("writes empty files when nothing survived", async () => {
		const { paths } = await runStep({ survivors: [] });

		await expect(readFile(paths.unmappedPair(1), "utf8")).resolves.toBe("");
		await expect(readFile(paths.unmappedPair(2), "utf8")).resolves.toBe("");
	});

	// `assemble` reads `unmapped_subtractions.fq` directly for a single-end
	// sample, so there is nothing to rebuild.
	it("does nothing for a single-end sample", async () => {
		const { paths } = await runStep({ paired: false });

		await expect(readFile(paths.unmappedPair(1), "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	// Biopython's `record.id` is the header up to the first whitespace, and the
	// two mates of a pair differ in the description that follows it. Splitting
	// anywhere else would make every read look unpaired.
	it("matches on the read id, ignoring the description after it", async () => {
		const setup = await setupStep({ paired: true });

		await mkdir(setup.paths.trimmedDir, { recursive: true });

		await writeFile(
			setup.paths.unmappedSubtractions,
			"@r1 1:N:0:ATCG\nACGT\n+\nIIII\n",
		);

		await writeGzipped(
			setup.paths.trimmedRead(1),
			"@r1 1:N:0:ATCG\nACGT\n+\nIIII\n@r2 1:N:0:ATCG\nACGT\n+\nIIII\n",
		);

		await writeGzipped(
			setup.paths.trimmedRead(2),
			"@r1 2:N:0:ATCG\nACGT\n+\nIIII\n@r2 2:N:0:ATCG\nACGT\n+\nIIII\n",
		);

		await reunitePairsStep.run(setup.context);

		// The right mate's description differs from the left's, and it is still
		// kept — so the match was on `r1` and not on the whole header.
		expect(
			parseFastqIds(await readFile(setup.paths.unmappedPair(2), "utf8")),
		).toEqual(["r1"]);
	});

	it("writes the header, sequence and quality of each kept record", async () => {
		const setup = await setupStep({ paired: true });

		await mkdir(setup.paths.trimmedDir, { recursive: true });

		await writeFile(setup.paths.unmappedSubtractions, "@r1\nAC\n+\nII\n");
		await writeGzipped(
			setup.paths.trimmedRead(1),
			"@r1 desc\nACGT\n+r1\nIIII\n",
		);
		await writeGzipped(setup.paths.trimmedRead(2), "@r1\nTTTT\n+\nJJJJ\n");

		await reunitePairsStep.run(setup.context);

		// The separator is written as a bare `+`, which is what Biopython writes
		// however the input spelled it.
		await expect(readFile(setup.paths.unmappedPair(1), "utf8")).resolves.toBe(
			"@r1 desc\nACGT\n+\nIIII\n",
		);
	});
});
