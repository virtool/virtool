import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
	assembleStep,
	DEFAULT_KMER_LENGTHS,
	kmerLengthsFor,
	SRNA_KMER_LENGTHS,
} from "./assemble";
import { decompressToString } from "./compression.testing";
import { flagValue, setupStep } from "./fixtures";

const SCAFFOLDS = ">NODE_1\nACGTACGTAC\n";

async function runStep(options: Parameters<typeof setupStep>[0] = {}) {
	const setup = await setupStep(options);

	// SPAdes is faked, so its output has to be put where the real one would.
	setup.runSubprocess.register("spades.py", {
		stdout: ["== Running assembler", "== Done"],
	});

	await mkdir(setup.paths.spadesDir, { recursive: true });
	await writeFile(setup.paths.spadesScaffolds, SCAFFOLDS);

	await assembleStep.run(setup.context);

	return { ...setup, command: setup.runSubprocess.commands()[0] ?? [] };
}

describe("kmerLengthsFor", () => {
	// sRNA reads are 20–24 nt, so the default set is longer than the reads
	// themselves and SPAdes would assemble nothing at all.
	it("narrows the k-mer lengths for an sRNA library", () => {
		expect(kmerLengthsFor("srna")).toBe(SRNA_KMER_LENGTHS);
		expect(SRNA_KMER_LENGTHS).toBe("17,21,23");
	});

	it.each(["normal", "amplicon", "other"])(
		"uses the default k-mer lengths for a %s library",
		(libraryType) => {
			expect(kmerLengthsFor(libraryType)).toBe(DEFAULT_KMER_LENGTHS);
			expect(DEFAULT_KMER_LENGTHS).toBe("21,33,55,75");
		},
	);
});

describe("assembleStep", () => {
	it("asks SPAdes for the default k-mer lengths", async () => {
		const { command } = await runStep();

		expect(flagValue(command, "-k")).toBe("21,33,55,75");
	});

	it("asks SPAdes for the sRNA k-mer lengths when the library is srna", async () => {
		const { command } = await runStep({ libraryType: "srna" });

		expect(flagValue(command, "-k")).toBe("17,21,23");
	});

	it("assembles the rebuilt pairs for a paired sample", async () => {
		const { command, paths } = await runStep({ paired: true });

		expect(flagValue(command, "-1")).toBe(paths.unmappedPair(1));
		expect(flagValue(command, "-2")).toBe(paths.unmappedPair(2));
		expect(command).not.toContain("-s");
	});

	// There were never pairs to restore, so `reunite_pairs` wrote nothing and the
	// subtraction pass's own output is the input.
	it("assembles the subtraction output directly for a single-end sample", async () => {
		const { command, paths } = await runStep({ paired: false });

		expect(flagValue(command, "-s")).toBe(paths.unmappedSubtractions);
		expect(command).not.toContain("-1");
	});

	it("passes the run's processor and memory budgets through", async () => {
		const { command, context, paths } = await runStep();

		expect(flagValue(command, "-t")).toBe(String(context.proc));
		expect(flagValue(command, "-m")).toBe(String(context.mem));
		expect(flagValue(command, "-o")).toBe(paths.spadesDir);
	});

	// Passing a handler is also what makes the runtime pipe stdout at all — SPAdes
	// narrates for an hour, and it is the only account of an assembly that
	// produced nothing.
	it("reads SPAdes' stdout", async () => {
		const { runSubprocess } = await runStep();

		expect(runSubprocess.calls()[0]?.stdout).toBeDefined();
	});

	it("compresses the scaffolds", async () => {
		const { paths } = await runStep();

		await expect(decompressToString(paths.compressedAssembly)).resolves.toBe(
			SCAFFOLDS,
		);
	});
});
