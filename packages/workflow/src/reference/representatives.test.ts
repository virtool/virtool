import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import type { RunSubprocess, RunSubprocessOptions } from "../subprocess/types";
import {
	getCdHitEstVersion,
	REFERENCE_REPRESENTATIVE_POLICY,
	type RepresentativeInputOtu,
	type RepresentativeInputSequence,
	selectReferenceRepresentatives,
} from "./representatives";

type TestSequence = RepresentativeInputSequence & {
	accession: string;
};

type TestRunner = RunSubprocess & {
	commands: readonly (readonly string[])[];
	inputs: readonly string[];
	maxActive: () => number;
};

function sequence(id: string, segment: string | null = null): TestSequence {
	return {
		accession: `AC_${id}`,
		id,
		segment,
		sequence: "ACGTACGTACGT",
	};
}

function otu(
	id: string,
	sequences: TestSequence[],
	schema: string[] = [],
): RepresentativeInputOtu<TestSequence> {
	return {
		id,
		isolates: [{ sequences }],
		schema: schema.map((name) => ({ name })),
	};
}

async function* otus(
	values: readonly RepresentativeInputOtu<TestSequence>[],
): AsyncGenerator<RepresentativeInputOtu<TestSequence>> {
	yield* values;
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
	const collected: T[] = [];

	for await (const value of values) {
		collected.push(value);
	}

	return collected;
}

async function scratchPath(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "workflow-representatives-test-"));

	onTestFinished(async () => {
		await rm(path, { force: true, recursive: true });
	});

	return path;
}

function result(command: readonly string[]) {
	return {
		cancelled: false,
		command,
		durationMs: 1,
		exitCode: 0,
		signal: null,
		stderrTail: [],
	};
}

function createRunner(
	clusters: (input: string, callIndex: number) => string,
	options: { delayMs?: number; failAt?: number } = {},
): TestRunner {
	const commands: Array<readonly string[]> = [];
	const inputs: string[] = [];
	let active = 0;
	let maximumActive = 0;

	const run: RunSubprocess = async (runOptions: RunSubprocessOptions) => {
		const callIndex = commands.length;
		commands.push(runOptions.command);

		const inputPath = runOptions.command[2] ?? "";
		const outputPath = runOptions.command[4] ?? "";
		const input = await readFile(inputPath, "utf8");
		inputs.push(input);

		active += 1;
		maximumActive = Math.max(maximumActive, active);

		try {
			if (options.delayMs !== undefined) {
				await new Promise((resolve) => setTimeout(resolve, options.delayMs));
			}

			if (options.failAt === callIndex) {
				throw new Error("cd-hit-est failed");
			}

			await writeFile(`${outputPath}.clstr`, clusters(input, callIndex));

			return result(runOptions.command);
		} finally {
			active -= 1;
		}
	};

	return Object.assign(run, {
		commands,
		inputs,
		maxActive() {
			return maximumActive;
		},
	});
}

function singletonClusters(input: string): string {
	const ids = [...input.matchAll(/^>(.+)$/gm)].map((match) => match[1] ?? "");

	return ids
		.map((id, index) => `>Cluster ${index}\n0\t12nt, >${id}... *\n`)
		.join("");
}

describe("selectReferenceRepresentatives", () => {
	it("groups in schema order, ignores defaults, and preserves source metadata", async () => {
		const path = await scratchPath();
		const isolate = {
			get default(): never {
				throw new Error("read default");
			},
			sequences: [
				sequence("seq_a1", "A"),
				sequence("seq_b1", "B"),
				sequence("seq_a2", "A"),
			],
		};
		const source: RepresentativeInputOtu<TestSequence>[] = [
			{
				id: "otu_segmented",
				isolates: [isolate],
				schema: [{ name: "B" }, { name: "A" }],
			},
			otu("otu_unsegmented", [sequence("seq_u1")]),
		];
		const runner = createRunner((_input, callIndex) => {
			if (callIndex === 1) {
				return [
					">Cluster 0",
					"0\t12nt, >seq_a1... at +/80.00%",
					"1\t12nt, >seq_a2... *",
					"",
				].join("\n");
			}

			return singletonClusters(_input);
		});

		const representatives = await collect(
			selectReferenceRepresentatives({
				concurrency: 1,
				otus: otus(source),
				runSubprocess: runner,
				scratchPath: path,
			}),
		);

		expect(representatives.map(({ id }) => id)).toEqual([
			"seq_b1",
			"seq_a2",
			"seq_u1",
		]);
		expect(representatives[1]).toMatchObject({
			accession: "AC_seq_a2",
			groupSegment: "A",
			otuId: "otu_segmented",
		});
		expect(runner.inputs).toEqual([
			">seq_b1\nACGTACGTACGT\n",
			">seq_a1\nACGTACGTACGT\n>seq_a2\nACGTACGTACGT\n",
			">seq_u1\nACGTACGTACGT\n",
		]);
		expect(await readdir(path)).toEqual([]);
	});

	it("passes the exact policy arguments once per group", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters);

		await collect(
			selectReferenceRepresentatives({
				concurrency: 1,
				otus: otus([otu("otu_1", [sequence("seq_1")])]),
				runSubprocess: runner,
				scratchPath: path,
			}),
		);

		expect(runner.commands).toHaveLength(1);
		expect(runner.commands[0]?.slice(5)).toEqual([
			"-c",
			"0.80",
			"-n",
			"5",
			"-l",
			"9",
			"-T",
			"1",
			"-M",
			"0",
			"-d",
			"0",
		]);
		expect(REFERENCE_REPRESENTATIVE_POLICY.coverage).toBe("none");
	});

	it("names scratch files with OTU and segment context", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters);

		await collect(
			selectReferenceRepresentatives({
				concurrency: 1,
				otus: otus([
					otu("otu/1", [sequence("seq_1", "RNA A/1")], ["RNA A/1"]),
					otu("otu_2", [sequence("seq_2")]),
				]),
				runSubprocess: runner,
				scratchPath: path,
			}),
		);

		expect(
			runner.commands.map((command) => [
				basename(command[2] ?? ""),
				basename(command[4] ?? ""),
			]),
		).toEqual([
			["otu_1_RNA_A_1_00000000.fa", "otu_1_RNA_A_1_00000000.cdhit"],
			["otu_2_unsegmented_00000001.fa", "otu_2_unsegmented_00000001.cdhit"],
		]);
		expect(await readdir(path)).toEqual([]);
	});

	it("emits one original sequence for every returned cluster", async () => {
		const path = await scratchPath();
		const runner = createRunner(() =>
			[
				">Cluster 0",
				"0\t12nt, >seq_1... at +/80.00%",
				"1\t12nt, >seq_2... *",
				">Cluster 1",
				"0\t12nt, >seq_3... *",
				"",
			].join("\n"),
		);

		const representatives = await collect(
			selectReferenceRepresentatives({
				concurrency: 1,
				otus: otus([
					otu("otu_1", [
						sequence("seq_1"),
						sequence("seq_2"),
						sequence("seq_3"),
					]),
				]),
				runSubprocess: runner,
				scratchPath: path,
			}),
		);

		expect(representatives.map(({ id }) => id)).toEqual(["seq_2", "seq_3"]);
		expect(representatives.map(({ accession }) => accession)).toEqual([
			"AC_seq_2",
			"AC_seq_3",
		]);
	});

	it("bounds concurrent subprocesses and cleans scratch files", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters, { delayMs: 5 });

		await collect(
			selectReferenceRepresentatives({
				concurrency: 2,
				otus: otus(
					Array.from({ length: 5 }, (_, index) =>
						otu(`otu_${index}`, [sequence(`seq_${index}`)]),
					),
				),
				runSubprocess: runner,
				scratchPath: path,
			}),
		);

		expect(runner.maxActive()).toBe(2);
		expect(await readdir(path)).toEqual([]);
	});

	it("rejects malformed grouping without running cd-hit-est", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters);

		await expect(
			collect(
				selectReferenceRepresentatives({
					concurrency: 1,
					otus: otus([
						otu("otu_1", [sequence("seq_1", "undeclared")], ["declared"]),
					]),
					runSubprocess: runner,
					scratchPath: path,
				}),
			),
		).rejects.toThrow("undeclared segment");

		expect(runner.commands).toEqual([]);
		expect(await readdir(path)).toEqual([]);
	});

	it("rejects a reference with no groups", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters);

		await expect(
			collect(
				selectReferenceRepresentatives({
					concurrency: 1,
					otus: otus([]),
					runSubprocess: runner,
					scratchPath: path,
				}),
			),
		).rejects.toThrow("Reference contains no OTU/segment groups");

		expect(await readdir(path)).toEqual([]);
	});

	it.each([
		[
			"malformed parser output",
			() => "not a cluster file\n",
			/Could not parse/,
		],
		[
			"incomplete cluster output",
			() => ">Cluster 0\n0\t12nt, >seq_1... *\n",
			/omits sequence seq_2/,
		],
	])("propagates %s and cleans scratch", async (_name, clusters, error) => {
		const path = await scratchPath();
		const runner = createRunner(clusters);

		await expect(
			collect(
				selectReferenceRepresentatives({
					concurrency: 1,
					otus: otus([otu("otu_1", [sequence("seq_1"), sequence("seq_2")])]),
					runSubprocess: runner,
					scratchPath: path,
				}),
			),
		).rejects.toThrow(error);

		expect(await readdir(path)).toEqual([]);
	});

	it("propagates subprocess failure after all active groups settle", async () => {
		const path = await scratchPath();
		const runner = createRunner(singletonClusters, { delayMs: 5, failAt: 0 });

		await expect(
			collect(
				selectReferenceRepresentatives({
					concurrency: 2,
					otus: otus([
						otu("otu_1", [sequence("seq_1")]),
						otu("otu_2", [sequence("seq_2")]),
					]),
					runSubprocess: runner,
					scratchPath: path,
				}),
			),
		).rejects.toThrow("cd-hit-est failed");

		expect(runner.commands).toHaveLength(2);
		expect(await readdir(path)).toEqual([]);
	});
});

describe("getCdHitEstVersion", () => {
	it("parses the version banner from a failing help invocation", async () => {
		const runSubprocess: RunSubprocess = async (options) => {
			await options.stderr?.("====== CD-HIT version 4.8.1 ======");
			throw new Error("help exited 1");
		};

		await expect(getCdHitEstVersion(runSubprocess)).resolves.toBe("4.8.1");
	});

	it("rejects help output without a version", async () => {
		const runSubprocess: RunSubprocess = async (options) => {
			await options.stdout?.("nothing here");
			return result(options.command);
		};

		await expect(getCdHitEstVersion(runSubprocess)).rejects.toThrow(
			"Could not parse cd-hit-est version",
		);
	});
});
