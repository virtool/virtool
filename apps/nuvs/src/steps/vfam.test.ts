import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { HmmClusterUnknownError } from "../hmms";
import type { NuvsRawContig } from "../state";
import { ANALYSIS_ID, flagValue, setupStep } from "./fixtures";
import { vfamStep } from "./vfam";

/**
 * One `hmmscan --tblout` row.
 *
 * The columns are hmmscan's: target name, target accession, query name, query
 * accession, then the full-sequence E-value, score and bias, then the
 * best-domain E-value, score and bias.
 */
function tbloutRow({
	cluster,
	query,
	fullE = "1e-10",
	fullScore = "50.5",
	fullBias = "0.1",
	bestE = "2e-10",
	bestDomainScore = "45.5",
	bestDomainBias = "0.2",
}: {
	cluster: number;
	query: string;
	fullE?: string;
	fullScore?: string;
	fullBias?: string;
	bestE?: string;
	bestDomainScore?: string;
	bestDomainBias?: string;
}): string {
	return [
		`vFam_${cluster}`,
		"-",
		query,
		"-",
		fullE,
		fullScore,
		fullBias,
		bestE,
		bestDomainScore,
		bestDomainBias,
		"1",
		"0",
		"0",
		"1",
		"1",
		"1",
		"1",
		"-",
	].join(" ");
}

function contig(index: number, orfCount: number): NuvsRawContig {
	return {
		index,
		orfs: Array.from({ length: orfCount }, (_orf, orfIndex) => ({
			frame: 0,
			hits: [],
			index: orfIndex,
			pos: [0, 300] as [number, number],
			pro: "M".repeat(100),
			strand: 1 as const,
		})),
		sequence: "A".repeat(450),
	};
}

const ANNOTATIONS = [
	{ cluster: 2, id: 100, families: { Baculoviridae: 3 }, names: ["capsid"] },
	{ cluster: 5, id: 200, families: {}, names: ["polymerase"] },
];

async function runStep({
	annotations = ANNOTATIONS,
	hits = [contig(0, 2), contig(1, 1)],
	rows = [
		tbloutRow({ cluster: 2, query: "sequence_0.0" }),
		tbloutRow({ cluster: 5, query: "sequence_1.0" }),
	],
}: {
	annotations?: unknown[];
	hits?: NuvsRawContig[];
	rows?: string[];
} = {}) {
	const setup = await setupStep({ hits });

	await setup.testStorage.seedAtKey("hmm/profiles.hmm", "HMMER3/f profiles");

	await setup.testStorage.seedAtKey(
		"hmm/annotations.json.gz",
		gzipSync(Buffer.from(JSON.stringify(annotations), "utf8")),
	);

	await mkdir(setup.paths.hmmsDir, { recursive: true });
	await writeFile(setup.paths.orfsFasta, ">sequence_0.0\nMMM\n");
	await writeFile(setup.paths.compressedAssembly, "assembly");
	await writeFile(setup.paths.compressedOrfs, "orfs");

	// hmmscan is faked, so the table it would have written has to be put where
	// the real one writes it. The comment lines are what the `vFam` prefix test
	// exists to skip.
	setup.runSubprocess.register("hmmscan", {});

	const run = async () => {
		await vfamStep.run({
			...setup.context,
			runSubprocess: async (options) => {
				if (options.command[0] === "hmmscan") {
					await writeFile(
						flagValue(options.command, "--tblout") ?? "",
						`# target name\n${rows.join("\n")}\n`,
					);
				}

				return setup.runSubprocess(options);
			},
		});
	};

	return { ...setup, run };
}

describe("vfamStep", () => {
	it("presses the profiles before scanning them", async () => {
		const { data, run, runSubprocess } = await runStep();

		await run();

		const commands = runSubprocess.commands();

		expect(commands[0]).toEqual(["hmmpress", data.hmms.profilesPath]);
		expect(commands[1]?.[0]).toBe("hmmscan");
	});

	// One core is left for this process, which is reading nothing while hmmscan
	// runs but still has to answer the ping loop.
	it("leaves one core for the runtime", async () => {
		const { context, run, runSubprocess } = await runStep();

		await run();

		expect(flagValue(runSubprocess.commands()[1] ?? [], "--cpu")).toBe(
			String(context.proc - 1),
		);
	});

	it("attaches each hit to the ORF its query name addresses", async () => {
		const { run, state } = await runStep();

		await run();

		expect(state.hits[0]?.orfs[0]?.hits).toHaveLength(1);
		expect(state.hits[0]?.orfs[1]?.hits).toEqual([]);
		expect(state.hits[1]?.orfs[0]?.hits).toHaveLength(1);
	});

	// The formatter merges `cluster`, `families` and `names` in from the `hmms`
	// table when the analysis is read. Writing them here would freeze a copy that
	// goes stale the next time the dataset is reinstalled.
	it("records the annotation id alone, not the annotation", async () => {
		const { run, state } = await runStep();

		await run();

		const [hit] = state.hits[0]?.orfs[0]?.hits ?? [];

		expect(hit?.hit).toBe(100);
		expect(hit).not.toHaveProperty("cluster");
		expect(hit).not.toHaveProperty("families");
		expect(hit).not.toHaveProperty("names");
		expect(hit).not.toHaveProperty("sequenceIndex");
		expect(hit).not.toHaveProperty("orfIndex");
	});

	it("joins a second cluster to its own annotation", async () => {
		const { run, state } = await runStep();

		await run();

		expect(state.hits[1]?.orfs[0]?.hits[0]?.hit).toBe(200);
	});

	// `best_bias` and `best_score` are read from the columns hmmscan documents as
	// the best-domain score and bias respectively — they are swapped. This
	// reproduces a bug in the Python workflow on purpose: the values are stored
	// under these names in every analysis blob written so far, and correcting it
	// on this side alone would silently disagree with all of them.
	it("stores the best-domain score as best_bias and the bias as best_score", async () => {
		const { run, state } = await runStep({
			rows: [
				tbloutRow({
					bestDomainBias: "7.5",
					bestDomainScore: "88.25",
					cluster: 2,
					query: "sequence_0.0",
				}),
			],
		});

		await run();

		const [hit] = state.hits[0]?.orfs[0]?.hits ?? [];

		expect(hit?.best_bias).toBe(88.25);
		expect(hit?.best_score).toBe(7.5);
	});

	it("stores the full-sequence figures under their own names", async () => {
		const { run, state } = await runStep({
			rows: [
				tbloutRow({
					cluster: 2,
					fullBias: "1.5",
					fullE: "3e-20",
					fullScore: "99.5",
					query: "sequence_0.0",
				}),
			],
		});

		await run();

		const [hit] = state.hits[0]?.orfs[0]?.hits ?? [];

		expect(hit?.full_e).toBe(3e-20);
		expect(hit?.full_score).toBe(99.5);
		expect(hit?.full_bias).toBe(1.5);
	});

	// Python drops a contig whose ORFs all ended up with empty hit lists, but the
	// branch only runs for a contig that just received a non-empty list, so it can
	// never fire. Porting it as though it does would renumber the contigs and
	// invalidate every stored index.
	it("keeps a contig none of whose ORFs matched", async () => {
		const { run, state } = await runStep({
			rows: [tbloutRow({ cluster: 2, query: "sequence_0.0" })],
		});

		await run();

		expect(state.hits.map(({ index }) => index)).toEqual([0, 1]);
		expect(state.hits[1]?.orfs[0]?.hits).toEqual([]);
	});

	it("fails when a cluster has no annotation", async () => {
		const { run } = await runStep({
			rows: [tbloutRow({ cluster: 999, query: "sequence_0.0" })],
		});

		await expect(run()).rejects.toThrow(HmmClusterUnknownError);
	});

	it("fails when a hit addresses an ORF this run did not produce", async () => {
		const { run } = await runStep({
			rows: [tbloutRow({ cluster: 2, query: "sequence_0.9" })],
		});

		await expect(run()).rejects.toThrow(/no ORF for/);
	});
});

/**
 * The manifest of the one finalize call the run made.
 *
 * Throws rather than returning `undefined`: a test asserting on a manifest that
 * was never sent should say so, not compare against nothing.
 */
function manifestOf(state: {
	finalizeCalls: readonly { request: unknown }[];
}): {
	description: null;
	format: string;
	kind: string;
	name: string;
	storageKey: string;
}[] {
	const [call] = state.finalizeCalls;

	if (!call) {
		throw new Error("the run made no finalize call");
	}

	return (
		call.request as {
			files: {
				description: null;
				format: string;
				kind: string;
				name: string;
				storageKey: string;
			}[];
		}
	).files;
}

describe("the vfam finalize call", () => {
	it("sends the results and all three retained files in one call", async () => {
		const { jobsApiState, run } = await runStep();

		await run();

		expect(jobsApiState.finalizeCalls).toHaveLength(1);

		const [call] = jobsApiState.finalizeCalls;

		expect(call?.resource).toBe("analysis");
		expect(call?.id).toBe(ANALYSIS_ID);

		expect(manifestOf(jobsApiState)).toEqual([
			{
				description: null,
				format: "fasta",
				kind: "analysisFile",
				name: "assembly.fa.gz",
				storageKey: expect.any(String),
			},
			{
				description: null,
				format: "fasta",
				kind: "analysisFile",
				name: "orfs.fa.gz",
				storageKey: expect.any(String),
			},
			{
				description: null,
				format: "tsv",
				kind: "analysisFile",
				name: "hmm.tsv",
				storageKey: expect.any(String),
			},
		]);
	});

	it("carries the annotated contigs as the results blob", async () => {
		const { jobsApiState, run, state } = await runStep();

		await run();

		expect(jobsApiState.finalizeCalls[0]?.request).toMatchObject({
			results: { hits: state.hits },
		});
	});

	// The key is minted here and sent; the jobs API checks it sits under this
	// analysis's own prefix and records it verbatim, so there is one opinion about
	// where the bytes went rather than two.
	it("uploads each file to a minted key under the analysis's prefix", async () => {
		const { jobsApiState, run, testStorage } = await runStep();

		await run();

		const files = manifestOf(jobsApiState);

		for (const file of files) {
			expect(file.storageKey.startsWith(`analyses/${ANALYSIS_ID}/`)).toBe(true);

			await expect(
				testStorage.storage.size(file.storageKey),
			).resolves.toBeGreaterThan(0);
		}

		// Three distinct keys, not one reused.
		expect(new Set(files.map(({ storageKey }) => storageKey)).size).toBe(3);
	});

	it("finalizes an empty result when the assembly produced no contigs", async () => {
		const { jobsApiState, run } = await runStep({ hits: [], rows: [] });

		await run();

		expect(jobsApiState.finalizeCalls[0]?.request).toMatchObject({
			results: { hits: [] },
		});
	});
});
