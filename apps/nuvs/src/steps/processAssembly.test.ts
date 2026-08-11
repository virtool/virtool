import { mkdir, readFile, writeFile } from "node:fs/promises";
import { findOrfs } from "@virtool/bio";
import { describe, expect, it } from "vitest";
import { decompressToString } from "./compression.testing";
import { setupStep } from "./fixtures";
import { processAssemblyStep } from "./processAssembly";

/** 450 bases of lysine codons: no stop in any frame, so every frame is an ORF. */
const WITH_ORFS = "AAA".repeat(150);

/** 360 more of the same, so the second surviving contig differs from the first. */
const ALSO_WITH_ORFS = "AAG".repeat(120);

/** 320 bases carrying a stop in every frame, forward and reverse. */
const NO_ORFS = "TAAT".repeat(80);

/** 240 bases — under the 300 the length filter allows. */
const TOO_SHORT = "ACGT".repeat(60);

function fasta(...sequences: readonly string[]): string {
	return sequences
		.map((sequence, index) => `>NODE_${index + 1}\n${sequence}\n`)
		.join("");
}

async function runStep(scaffolds: string) {
	const setup = await setupStep();

	await mkdir(setup.paths.spadesDir, { recursive: true });
	await writeFile(setup.paths.spadesScaffolds, scaffolds);

	await processAssemblyStep.run(setup.context);

	return setup;
}

describe("processAssemblyStep", () => {
	it("renames the scaffolds so only this step reads the uncompressed copy", async () => {
		const { paths } = await runStep(fasta(WITH_ORFS));

		await expect(readFile(paths.assemblyFasta, "utf8")).resolves.toContain(
			">NODE_1",
		);

		await expect(readFile(paths.spadesScaffolds, "utf8")).rejects.toThrow(
			/ENOENT/,
		);
	});

	it("drops a contig shorter than 300 bases", async () => {
		const { state } = await runStep(fasta(TOO_SHORT, WITH_ORFS));

		expect(state.hits).toHaveLength(1);
		expect(state.hits[0]?.sequence).toBe(WITH_ORFS);
	});

	// The two filters are very nearly the same one — 100 residues needs 300 bases
	// — but not exactly: a long contig whose every frame is interrupted survives
	// the length test and is dropped here.
	it("drops a long contig with no open reading frames", async () => {
		expect(NO_ORFS.length).toBeGreaterThan(300);
		expect(findOrfs(NO_ORFS)).toHaveLength(0);

		const { state } = await runStep(fasta(NO_ORFS, WITH_ORFS));

		expect(state.hits).toHaveLength(1);
	});

	// The index is the id every later reference addresses the contig by — a BLAST
	// request, the UI's routing — so it counts what *survived*, not what the
	// assembler produced.
	it("numbers the surviving contigs from zero, in file order", async () => {
		const { state } = await runStep(
			fasta(TOO_SHORT, NO_ORFS, WITH_ORFS, ALSO_WITH_ORFS),
		);

		expect(state.hits.map(({ index }) => index)).toEqual([0, 1]);
		expect(state.hits.map(({ sequence }) => sequence)).toEqual([
			WITH_ORFS,
			ALSO_WITH_ORFS,
		]);
	});

	it("numbers each contig's ORFs from zero and starts them with no hits", async () => {
		const { state } = await runStep(fasta(WITH_ORFS));

		const orfs = state.hits[0]?.orfs ?? [];

		expect(orfs.length).toBe(findOrfs(WITH_ORFS).length);
		expect(orfs.map(({ index }) => index)).toEqual(
			orfs.map((_orf, index) => index),
		);

		for (const orf of orfs) {
			expect(orf.hits).toEqual([]);
		}
	});

	// `nuc` is recoverable from the contig's own sequence and the ORF's `pos`, and
	// keeping it would roughly double the largest thing a NuVs analysis stores.
	it("drops each ORF's nucleotide slice but keeps its coordinates", async () => {
		const { state } = await runStep(fasta(WITH_ORFS));

		const [orf] = state.hits[0]?.orfs ?? [];
		const [expected] = findOrfs(WITH_ORFS);

		expect(orf).not.toHaveProperty("nuc");

		expect(orf).toMatchObject({
			frame: expected?.frame,
			pos: expected?.pos,
			pro: expected?.pro,
			strand: expected?.strand,
		});
	});

	// The header is the only thing carrying the contig and ORF indexes into
	// HMMER's output, which `parseHmmerTblout` reads straight back out of the
	// target name. Changing this format unmoors every hit from its ORF.
	it("writes each ORF under a sequence_<contig>.<orf> header", async () => {
		const { paths, state } = await runStep(fasta(WITH_ORFS, ALSO_WITH_ORFS));

		const written = await readFile(paths.orfsFasta, "utf8");

		expect(written.startsWith(">sequence_0.0\n")).toBe(true);
		expect(written).toContain(">sequence_1.0\n");

		const headers = written.split("\n").filter((line) => line.startsWith(">"));

		expect(headers).toHaveLength(
			state.hits.reduce((total, hit) => total + hit.orfs.length, 0),
		);
	});

	it("writes each ORF's translation under its header", async () => {
		const { paths, state } = await runStep(fasta(WITH_ORFS));

		const lines = (await readFile(paths.orfsFasta, "utf8")).split("\n");

		expect(lines[1]).toBe(state.hits[0]?.orfs[0]?.pro);
	});

	it("compresses the ORFs fasta", async () => {
		const { paths } = await runStep(fasta(WITH_ORFS));

		await expect(decompressToString(paths.compressedOrfs)).resolves.toBe(
			await readFile(paths.orfsFasta, "utf8"),
		);
	});

	// A sample carrying no novel virus assembles into nothing over 300 bases with
	// an ORF in it. `vfam` then annotates nothing and finalizes an empty list.
	it("records no contigs when nothing survives", async () => {
		const { paths, state } = await runStep(fasta(TOO_SHORT, NO_ORFS));

		expect(state.hits).toEqual([]);
		await expect(readFile(paths.orfsFasta, "utf8")).resolves.toBe("");
	});
});
