import { describe, expect, it } from "vitest";
import { buildSeqkitCommand, createBaseCountAccumulator } from "./seqkit";

/** Feed `lines` through a fresh accumulator and take its result. */
function accumulate(...lines: string[]) {
	const accumulator = createBaseCountAccumulator();

	for (const line of lines) {
		accumulator.handleLine(line);
	}

	return accumulator.result();
}

describe("buildSeqkitCommand", () => {
	// Python's command, argument for argument. The five `--base-count` flags
	// decide the column order the accumulator reads, so this pins both.
	it("matches Python's invocation", () => {
		expect(buildSeqkitCommand("/work/subtraction.fa.gz", 4)).toEqual([
			"seqkit",
			"fx2tab",
			"--name",
			"--only-id",
			"--threads",
			"4",
			"--base-count",
			"a",
			"--base-count",
			"t",
			"--base-count",
			"g",
			"--base-count",
			"c",
			"--base-count",
			"n",
			"/work/subtraction.fa.gz",
		]);
	});
});

describe("createBaseCountAccumulator", () => {
	// Python's own fixture, `>seq_1\nATGCATGCNN\n>seq_2\natgcatgcat\n`, as
	// seqkit reports it — `--base-count` ignores case, so the mixed-case second
	// record contributes the same as an upper-case one would.
	it("matches Python's mixed-case fixture", () => {
		expect(accumulate("seq_1\t2\t2\t2\t2\t2", "seq_2\t3\t3\t2\t2\t0")).toEqual({
			count: 2,
			gc: { a: 0.25, t: 0.25, g: 0.2, c: 0.2, n: 0.1 },
		});
	});

	it("counts one sequence per record", () => {
		expect(
			accumulate("a\t1\t0\t0\t0\t0", "b\t1\t0\t0\t0\t0", "c\t1\t0\t0\t0\t0")
				.count,
		).toBe(3);
	});

	// The denominator is the five counters' sum. seqkit reports no column for an
	// ambiguity code, so it is absent from both sides and the shares still total
	// one.
	it("divides by the counted bases rather than the sequence length", () => {
		expect(accumulate("seq_1\t1\t1\t1\t1\t0").gc).toEqual({
			a: 0.25,
			t: 0.25,
			g: 0.25,
			c: 0.25,
			n: 0,
		});
	});

	// `Math.round(0.0625 * 1000) / 1000` is 0.063; Python's `round(0.0625, 3)`
	// is 0.062, because it breaks a tie toward the even digit. A genome landing
	// on one of these is what the two implementations would disagree about.
	it("rounds a half-way ratio to even, as Python does", () => {
		// 1/16 and 3/16 are both exact, and tie in opposite directions.
		const { gc } = accumulate("seq_1\t1\t3\t6\t6\t0");

		expect(gc.a).toBe(0.062);
		expect(gc.t).toBe(0.188);
	});

	it("ignores the empty line seqkit's trailing newline produces", () => {
		expect(accumulate("seq_1\t1\t1\t1\t1\t0", "").count).toBe(1);
	});

	// Python raises for each separately, in this order, rather than dividing by
	// zero.
	it("refuses a FASTA with no sequences", () => {
		expect(() => accumulate()).toThrow(
			"No sequences found in subtraction FASTA",
		);
	});

	it("refuses sequences holding none of the five bases", () => {
		expect(() => accumulate("seq_1\t0\t0\t0\t0\t0")).toThrow(
			"No A, T, G, C, or N bases found in subtraction FASTA",
		);
	});

	// A column count that disagrees with the flags would otherwise produce a
	// plausible-looking composition built from `NaN`.
	it("refuses a row whose column count disagrees with the flags", () => {
		expect(() => accumulate("seq_1\t1\t1\t1")).toThrow(/Expected 6 columns/);
	});

	it("refuses a non-numeric count", () => {
		expect(() => accumulate("seq_1\t1\t1\t1\t1\tNA")).toThrow(
			/non-numeric n count/,
		);
	});
});
