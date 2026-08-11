import { readFile, writeFile } from "node:fs/promises";
import type { RunSubprocess } from "@virtool/workflow";
import { describe, expect, it } from "vitest";
import { eliminateSubtractionStep } from "./eliminateSubtraction";
import { fastq, flagValue, parseFastqIds, setupStep } from "./fixtures";

/**
 * Run the step against a bowtie2 that drops the ids it is told to.
 *
 * One entry of `eliminationsPerPass` per subtraction. The fake is modelled down
 * to reading `-U` and writing `--un`, because which file each pass reads is the
 * whole substance of the step.
 */
async function runStep(
	eliminationsPerPass: readonly (readonly string[])[],
	subtractionCount: number,
) {
	const setup = await setupStep({ subtractionCount });

	await writeFile(setup.paths.unmappedOtus, fastq("r1", "r2", "r3"));

	const inputs: string[] = [];
	const commands: (readonly string[])[] = [];
	let pass = 0;

	const runSubprocess: RunSubprocess = async (options) => {
		commands.push(options.command);

		const contents = await readFile(
			flagValue(options.command, "-U") ?? "",
			"utf8",
		);

		inputs.push(contents);

		const eliminated = new Set(eliminationsPerPass[pass] ?? []);
		pass += 1;

		await writeFile(
			flagValue(options.command, "--un") ?? "",
			fastq(...parseFastqIds(contents).filter((id) => !eliminated.has(id))),
		);

		return {
			command: options.command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	};

	await eliminateSubtractionStep.run({ ...setup.context, runSubprocess });

	return { ...setup, commands, inputs };
}

describe("eliminateSubtractionStep", () => {
	it("carries the filtered reads into every later subtraction pass", async () => {
		const { inputs, paths } = await runStep([["r1"], ["r2"]], 2);

		// The second pass must see what the first left, not the original reads.
		expect(parseFastqIds(inputs[0] ?? "")).toEqual(["r1", "r2", "r3"]);
		expect(parseFastqIds(inputs[1] ?? "")).toEqual(["r2", "r3"]);

		expect(
			parseFastqIds(await readFile(paths.unmappedSubtractions, "utf8")),
		).toEqual(["r3"]);
	});

	it("runs one bowtie2 pass per subtraction, against that subtraction's index", async () => {
		const { commands, paths } = await runStep([[], []], 2);

		expect(commands).toHaveLength(2);
		expect(commands.map((command) => command[0])).toEqual([
			"bowtie2",
			"bowtie2",
		]);
		expect(commands.map((command) => flagValue(command, "-x"))).toEqual([
			paths.subtraction(1).indexPrefix,
			paths.subtraction(2).indexPrefix,
		]);
	});

	// With nothing to subtract against there is no mapping to do, and the reads
	// carry straight through under the name the assembler expects.
	it("carries every read forward when there are no subtractions", async () => {
		const setup = await setupStep({ subtractionCount: 0 });

		await writeFile(setup.paths.unmappedOtus, fastq("r1", "r2", "r3"));

		await eliminateSubtractionStep.run(setup.context);

		expect(setup.runSubprocess.commands()).toHaveLength(0);

		expect(
			parseFastqIds(await readFile(setup.paths.unmappedSubtractions, "utf8")),
		).toEqual(["r1", "r2", "r3"]);
	});

	// Python copies at every hand-off, which is a full copy of a multi-gigabyte
	// FASTQ per subtraction on a disk sized for one. Nothing reads either path
	// between passes, so moving is equivalent — and this is what proves it moved.
	it("moves the unmapped reads rather than copying them", async () => {
		const { paths } = await runStep([["r1"]], 1);

		await expect(readFile(paths.unmappedOtus, "utf8")).rejects.toThrow(
			/ENOENT/,
		);
		await expect(readFile(paths.workingOtus, "utf8")).rejects.toThrow(/ENOENT/);
	});

	// Python wraps the index prefix in `shlex.quote`, which is a no-op for every
	// path it is ever given and would be wrong if it were not: the command is an
	// argument array, never a shell string.
	it("passes the index prefix unquoted", async () => {
		const { commands, paths } = await runStep([[]], 1);

		expect(flagValue(commands[0] ?? [], "-x")).toBe(
			paths.subtraction(1).indexPrefix,
		);
	});
});
