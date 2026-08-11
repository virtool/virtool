import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type {
	IndexOtu,
	IndexOtuIsolate,
	IndexOtuSequence,
	RunSubprocess,
} from "@virtool/workflow";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
	type CollapseSegment,
	collapseOtu,
	createCollapseTally,
	createSegmentCollapser,
	prepareOtuCollapse,
	writeSegmentFasta,
} from "./collapse";

function createSequence(
	id: string,
	overrides: Partial<IndexOtuSequence> = {},
): IndexOtuSequence {
	return {
		accession: `AC_${id}`,
		definition: `Sequence ${id}`,
		host: null,
		id,
		segment: null,
		sequence: "ACGT",
		...overrides,
	};
}

function createIsolate(
	id: string,
	sequences: IndexOtuSequence[],
	isDefault = false,
): IndexOtuIsolate {
	return {
		default: isDefault,
		id,
		sequences,
		source_name: id,
		source_type: "isolate",
	};
}

function createOtu(
	isolates: IndexOtuIsolate[],
	schema: IndexOtu["schema"] = [],
): IndexOtu {
	return {
		abbreviation: "TMV",
		id: "otu_1",
		isolates,
		name: "Tobacco mosaic virus",
		schema,
		taxid: 12242,
		version: 3,
	};
}

/** Collapse every sequence onto one representative, as an identical cluster would. */
function collapseTo(representative: string): CollapseSegment {
	return async (_input, _output, sequences) =>
		new Map(sequences.map((sequence) => [sequence.id, representative]));
}

/** Leave every sequence as its own representative — nothing is redundant. */
const collapseToSelf: CollapseSegment = async (_input, _output, sequences) =>
	new Map(sequences.map((sequence) => [sequence.id, sequence.id]));

async function tempDir(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "pathoscope-collapse-"));

	onTestFinished(() => rm(directory, { force: true, recursive: true }));

	return directory;
}

describe("prepareOtuCollapse", () => {
	it("groups an unsegmented OTU's sequences under the empty segment", () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [createSequence("seq_2")]),
		]);

		expect([...(prepareOtuCollapse(otu) ?? [])]).toEqual([
			["", [createSequence("seq_1"), createSequence("seq_2")]],
		]);
	});

	// With no schema there is nothing to match sequences up by, so two isolates
	// carrying different numbers of sequences have incomparable representative
	// sets.
	it("refuses an unsegmented OTU whose isolate has more than one sequence", () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [
				createSequence("seq_2"),
				createSequence("seq_3"),
			]),
		]);

		expect(prepareOtuCollapse(otu)).toBeNull();
	});

	it("groups a schema'd OTU's sequences by segment", () => {
		const otu = createOtu(
			[
				createIsolate(
					"iso_1",
					[
						createSequence("seq_1", { segment: "RNA A" }),
						createSequence("seq_2", { segment: "RNA B" }),
					],
					true,
				),
				createIsolate("iso_2", [createSequence("seq_3", { segment: "RNA A" })]),
			],
			[
				{ molecule: "ssRNA", name: "RNA A", required: true },
				{ molecule: "ssRNA", name: "RNA B", required: false },
			],
		);

		const grouped = prepareOtuCollapse(otu);

		expect(grouped?.get("RNA A")?.map((s) => s.id)).toEqual(["seq_1", "seq_3"]);
		expect(grouped?.get("RNA B")?.map((s) => s.id)).toEqual(["seq_2"]);
	});

	it.each([
		["a null segment", null],
		["an empty segment", ""],
	])("refuses a schema'd OTU with %s", (_label, segment) => {
		const otu = createOtu(
			[
				createIsolate("iso_1", [createSequence("seq_1", { segment })], true),
				createIsolate("iso_2", [createSequence("seq_2", { segment: "RNA A" })]),
			],
			[{ molecule: null, name: "RNA A", required: true }],
		);

		expect(prepareOtuCollapse(otu)).toBeNull();
	});

	it("refuses a segment the schema does not declare", () => {
		const otu = createOtu(
			[
				createIsolate(
					"iso_1",
					[createSequence("seq_1", { segment: "RNA Z" })],
					true,
				),
				createIsolate("iso_2", [createSequence("seq_2", { segment: "RNA A" })]),
			],
			[{ molecule: null, name: "RNA A", required: true }],
		);

		expect(prepareOtuCollapse(otu)).toBeNull();
	});

	it("refuses an isolate that repeats a segment", () => {
		const otu = createOtu(
			[
				createIsolate(
					"iso_1",
					[
						createSequence("seq_1", { segment: "RNA A" }),
						createSequence("seq_2", { segment: "RNA A" }),
					],
					true,
				),
				createIsolate("iso_2", [createSequence("seq_3", { segment: "RNA A" })]),
			],
			[{ molecule: null, name: "RNA A", required: true }],
		);

		expect(prepareOtuCollapse(otu)).toBeNull();
	});
});

describe("collapseOtu", () => {
	// Checked before eligibility: one isolate cannot be redundant with anything,
	// so there is no cd-hit-est run to pay for.
	it("passes a single-isolate OTU through without running cd-hit-est", async () => {
		const collapseSegment = vi.fn(collapseToSelf);
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
		]);

		const result = await collapseOtu(otu, await tempDir(), collapseSegment);

		expect(result.outcome).toBe("unchanged");
		expect(result.otu).toBe(otu);
		expect(collapseSegment).not.toHaveBeenCalled();
	});

	it("passes an ineligible OTU through untouched", async () => {
		const collapseSegment = vi.fn(collapseToSelf);
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [
				createSequence("seq_2"),
				createSequence("seq_3"),
			]),
		]);

		const result = await collapseOtu(otu, await tempDir(), collapseSegment);

		expect(result.outcome).toBe("skipped");
		expect(result.otu.isolates).toHaveLength(2);
		expect(collapseSegment).not.toHaveBeenCalled();
	});

	it("drops an isolate that lands on the same representatives as an earlier one", async () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [createSequence("seq_2")]),
			createIsolate("iso_3", [createSequence("seq_3")]),
		]);

		const result = await collapseOtu(otu, await tempDir(), collapseTo("seq_1"));

		expect(result.outcome).toBe("collapsed");
		expect(result.otu.isolates.map((isolate) => isolate.id)).toEqual(["iso_1"]);
	});

	it("keeps every isolate when none is redundant", async () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [createSequence("seq_2")]),
		]);

		const result = await collapseOtu(otu, await tempDir(), collapseToSelf);

		expect(result.otu.isolates.map((isolate) => isolate.id)).toEqual([
			"iso_1",
			"iso_2",
		]);
	});

	// Iteration order decides which duplicate survives, and the default isolate
	// is kept whatever its position.
	it("keeps a default isolate that duplicates an earlier one", async () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")]),
			createIsolate("iso_2", [createSequence("seq_2")], true),
		]);

		const result = await collapseOtu(otu, await tempDir(), collapseTo("seq_1"));

		expect(result.otu.isolates.map((isolate) => isolate.id)).toEqual([
			"iso_1",
			"iso_2",
		]);
	});

	it("runs one cd-hit-est per segment, named after the OTU and segment", async () => {
		const collapseSegment = vi.fn(collapseToSelf);

		const otu = createOtu(
			[
				createIsolate(
					"iso_1",
					[
						createSequence("seq_1", { segment: "RNA B" }),
						createSequence("seq_2", { segment: "RNA A" }),
					],
					true,
				),
				createIsolate("iso_2", [createSequence("seq_3", { segment: "RNA A" })]),
			],
			[
				{ molecule: null, name: "RNA A", required: true },
				{ molecule: null, name: "RNA B", required: false },
			],
		);

		await collapseOtu(otu, await tempDir(), collapseSegment);

		// Sorted by segment name, so the run is reproducible.
		expect(
			collapseSegment.mock.calls.map(([input, output]) => [
				basename(input),
				basename(output),
			]),
		).toEqual([
			["otu-otu_1-segment-RNA A.fa", "otu-otu_1-segment-RNA A.cdhit"],
			["otu-otu_1-segment-RNA B.fa", "otu-otu_1-segment-RNA B.cdhit"],
		]);
	});

	it("fails when a sequence is missing from the cluster file", async () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [createSequence("seq_2")]),
		]);

		const partial: CollapseSegment = async () => new Map([["seq_1", "seq_1"]]);

		await expect(collapseOtu(otu, await tempDir(), partial)).rejects.toThrow(
			/seq_2/,
		);
	});

	it("propagates a cd-hit-est failure", async () => {
		const otu = createOtu([
			createIsolate("iso_1", [createSequence("seq_1")], true),
			createIsolate("iso_2", [createSequence("seq_2")]),
		]);

		const failing: CollapseSegment = () =>
			Promise.reject(new Error("cd-hit-est exited 1"));

		await expect(collapseOtu(otu, await tempDir(), failing)).rejects.toThrow(
			"cd-hit-est exited 1",
		);
	});
});

describe("createSegmentCollapser", () => {
	// The output is `…​.cdhit`, so the cluster file cd-hit-est writes beside it is
	// `…​.cdhit.clstr`.
	it("invokes cd-hit-est and reads back the .cdhit.clstr file", async () => {
		const directory = await tempDir();
		const outputPath = join(directory, "otu-otu_1-segment-.cdhit");

		const runSubprocess = vi.fn<RunSubprocess>(async ({ command }) => {
			await writeSegmentFasta(`${outputPath}.clstr`, []);

			return {
				command,
				exitCode: 0,
				signal: null,
				cancelled: false,
				stderrTail: [],
				durationMs: 1,
			};
		});

		const collapse = createSegmentCollapser(runSubprocess);

		await collapse(join(directory, "otu-otu_1-segment-.fa"), outputPath, []);

		expect(runSubprocess.mock.calls[0]?.[0].command).toEqual([
			"cd-hit-est",
			"-i",
			join(directory, "otu-otu_1-segment-.fa"),
			"-o",
			outputPath,
			"-c",
			"0.99",
			"-T",
			"1",
			"-M",
			"0",
			"-d",
			"0",
		]);

		expect(basename(`${outputPath}.clstr`)).toBe(
			"otu-otu_1-segment-.cdhit.clstr",
		);
	});
});

describe("writeSegmentFasta", () => {
	it("writes one record per sequence", async () => {
		const path = join(await tempDir(), "segment.fa");

		await writeSegmentFasta(path, [
			createSequence("seq_1", { sequence: "ACGT" }),
			createSequence("seq_2", { sequence: "TTTT" }),
		]);

		expect(await readFile(path, "utf8")).toBe(">seq_1\nACGT\n>seq_2\nTTTT\n");
	});
});

describe("createCollapseTally", () => {
	it("starts at zero", () => {
		expect(createCollapseTally().summary()).toEqual({
			isolate_count_before: 0,
			isolate_count_after: 0,
			isolate_count_removed: 0,
			otu_count_collapsed: 0,
			otu_count_unchanged: 0,
			otu_count_skipped: 0,
		});
	});

	// `isolate_count_removed` is derived, so it can only be read once every
	// result has been recorded — which is what the tally makes explicit and the
	// caller-allocated summary object it replaced did not.
	it("counts isolates before and after, and the outcomes", async () => {
		const tally = createCollapseTally();
		const directory = await tempDir();

		tally.record(
			await collapseOtu(
				createOtu([
					createIsolate("iso_1", [createSequence("seq_1")], true),
					createIsolate("iso_2", [createSequence("seq_2")]),
				]),
				directory,
				collapseTo("seq_1"),
			),
		);

		tally.record(
			await collapseOtu(
				createOtu([createIsolate("iso_1", [createSequence("seq_3")], true)]),
				directory,
				collapseToSelf,
			),
		);

		expect(tally.summary()).toEqual({
			isolate_count_before: 3,
			isolate_count_after: 2,
			isolate_count_removed: 1,
			otu_count_collapsed: 1,
			otu_count_unchanged: 1,
			otu_count_skipped: 0,
		});
	});
});

describe("collapseOtu concurrency", () => {
	// Each cd-hit-est run is given `-T 1`, so the parallelism is this bound
	// rather than the tool's.
	it("runs at most `limit` segments at a time", async () => {
		let active = 0;
		let peak = 0;

		const collapseSegment: CollapseSegment = async (
			_input,
			_output,
			sequences,
		) => {
			active += 1;
			peak = Math.max(peak, active);

			await new Promise((resolve) => setTimeout(resolve, 1));

			active -= 1;

			return new Map(sequences.map((sequence) => [sequence.id, sequence.id]));
		};

		const schema = ["A", "B", "C", "D", "E", "F"].map((name) => ({
			molecule: null,
			name,
			required: false,
		}));

		const otu = createOtu(
			[
				createIsolate(
					"iso_1",
					schema.map((item, index) =>
						createSequence(`seq_${index}`, { segment: item.name }),
					),
					true,
				),
				createIsolate(
					"iso_2",
					schema.map((item, index) =>
						createSequence(`other_${index}`, { segment: item.name }),
					),
				),
			],
			schema,
		);

		await collapseOtu(otu, await tempDir(), collapseSegment, 2);

		expect(peak).toBe(2);
		expect(active).toBe(0);
	});
});
