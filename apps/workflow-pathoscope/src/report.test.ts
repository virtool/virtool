import { describe, expect, it } from "vitest";
import type { PathoscopeEmResults } from "./pathoscopeCore";
import { buildReport } from "./report";

type Columns = {
	pi: number;
	initPi: number;
	bestHitInitial: number;
	bestHitInitialReads: number;
	bestHitFinal: number;
	bestHitFinalReads: number;
	level1Initial: number;
	level2Initial: number;
	level1Final: number;
	level2Final: number;
};

/** EM results built from one row per reference, in the order given. */
function createResults(
	rows: readonly ({ ref: string } & Partial<Columns>)[],
	overrides: Partial<PathoscopeEmResults> = {},
): PathoscopeEmResults {
	const column = (name: keyof Columns, fallback: number) =>
		rows.map((row) => row[name] ?? fallback);

	return {
		refs: rows.map((row) => row.ref),
		pi: column("pi", 0.5),
		init_pi: column("initPi", 0.5),
		best_hit_initial: column("bestHitInitial", 1),
		best_hit_initial_reads: column("bestHitInitialReads", 10),
		best_hit_final: column("bestHitFinal", 1),
		best_hit_final_reads: column("bestHitFinalReads", 10),
		level_1_initial: column("level1Initial", 1),
		level_2_initial: column("level2Initial", 1),
		level_1_final: column("level1Final", 1),
		level_2_final: column("level2Final", 1),
		read_count: 0,
		coverage: {},
		...overrides,
	};
}

describe("buildReport", () => {
	it("orders references by share of reads, descending", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.2 },
				{ ref: "seq_b", pi: 0.5 },
				{ ref: "seq_c", pi: 0.3 },
			]),
		);

		expect(report.map((entry) => entry.id)).toEqual([
			"seq_b",
			"seq_c",
			"seq_a",
		]);
	});

	// `pi` ties routinely — a segmented OTU's isolates share one — and the EM
	// core emits rows out of a hash map, so without a stable tie-break two runs
	// over the same alignment could cut the report in different places.
	it("breaks a tie on pi by reference id, descending", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.5 },
				{ ref: "seq_c", pi: 0.5 },
				{ ref: "seq_b", pi: 0.5 },
			]),
		);

		expect(report.map((entry) => entry.id)).toEqual([
			"seq_c",
			"seq_b",
			"seq_a",
		]);
	});

	it("orders identically however the input rows are ordered", () => {
		const rows = [
			{ ref: "seq_a", pi: 0.5 },
			{ ref: "seq_b", pi: 0.5 },
			{ ref: "seq_c", pi: 0.9 },
		];

		expect([
			...buildReport(createResults(rows)).map((entry) => entry.id),
		]).toEqual([
			...buildReport(createResults([...rows].reverse())).map(
				(entry) => entry.id,
			),
		]);
	});

	// The cutoff is a count of leading rows, not a filter: everything after the
	// first uninteresting row goes too.
	it("stops at the first row below the cutoff with no confident hits", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.9 },
				{ ref: "seq_b", pi: 0.005, level1Final: 0, level2Final: 0 },
				{ ref: "seq_c", pi: 0.004, level1Final: 5, level2Final: 5 },
			]),
		);

		expect(report.map((entry) => entry.id)).toEqual(["seq_a"]);
	});

	it("keeps a low-pi reference that still has confident hits", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.9 },
				{ ref: "seq_b", pi: 0.001, level1Final: 3, level2Final: 0 },
			]),
		);

		expect(report.map((entry) => entry.id)).toEqual(["seq_a", "seq_b"]);
	});

	it("keeps a reference at the cutoff exactly", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.01, level1Final: 0, level2Final: 0 },
			]),
		);

		expect(report.map((entry) => entry.id)).toEqual(["seq_a"]);
	});

	it("returns nothing when every reference is uninteresting", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", pi: 0.001, level1Final: 0, level2Final: 0 },
			]),
		);

		expect(report.length).toBe(0);
	});

	it("splits each reference's figures into final and initial", () => {
		const report = buildReport(
			createResults([
				{
					ref: "seq_a",
					pi: 0.75,
					initPi: 0.5,
					bestHitFinal: 0.8,
					bestHitFinalReads: 42,
					level1Final: 3,
					level2Final: 2,
					bestHitInitial: 0.6,
					bestHitInitialReads: 30,
					level1Initial: 1,
					level2Initial: 4,
				},
			]),
		);

		expect(report[0]).toEqual({
			id: "seq_a",
			final: { pi: 0.75, best: 0.8, high: 3, low: 2, reads: 42 },
			initial: { pi: 0.5, best: 0.6, high: 1, low: 4, reads: 30 },
		});
	});

	it("rounds to ten decimal places", () => {
		const report = buildReport(createResults([{ ref: "seq_a", pi: 1 / 3 }]));

		expect(report[0]?.final.pi).toBe(0.3333333333);
	});

	// The EM core types every read count as an `f64`, so it arrives fractional.
	it("truncates a fractional read count to whole reads", () => {
		const report = buildReport(
			createResults([
				{ ref: "seq_a", bestHitFinalReads: 41.9, bestHitInitialReads: 30.2 },
			]),
		);

		expect(report[0]?.final.reads).toBe(41);
		expect(report[0]?.initial.reads).toBe(30);
	});

	it("returns nothing for an alignment with no references", () => {
		expect(buildReport(createResults([])).length).toBe(0);
	});

	// The arrays are positional, so one short by a single element shifts every
	// figure after it onto the wrong reference — and the report would look
	// entirely plausible.
	it("refuses results whose arrays disagree in length", () => {
		const results = createResults([{ ref: "seq_a" }, { ref: "seq_b" }]);

		expect(() => buildReport({ ...results, pi: [0.5] })).toThrow(
			/1 pi values for 2 references/,
		);
	});
});
