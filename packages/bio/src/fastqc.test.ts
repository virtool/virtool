import { Quality } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { compositeQuality, parseFastqcData, roundHalfEven } from "./fastqc";

function section(name: string, status: string, lines: string[]): string[] {
	return [`>>${name}\t${status}`, ...lines, ">>END_MODULE"];
}

const BASIC_STATISTICS = section("Basic Statistics", "pass", [
	"#Measure\tValue",
	"Filename\treads.fq.gz",
	"Total Sequences\t14213",
	"Sequences flagged as poor quality\t0",
	"Sequence length\t35-151",
	"%GC\t43.5",
	"Encoding\tSanger / Illumina 1.9",
]);

const QUALITY_HEADER =
	"#Base\tMean\tMedian\tLower Quartile\tUpper Quartile\t10th Percentile\t90th Percentile";

const COMPOSITION_HEADER = "#Base\tG\tA\tT\tC";

function build(parts: string[][]): string {
	return `${parts.flat().join("\n")}\n`;
}

describe("roundHalfEven", () => {
	it("rounds halves to even rather than away from zero", () => {
		expect(roundHalfEven(2.5, 0)).toBe(2);
		expect(roundHalfEven(3.5, 0)).toBe(4);
		expect(roundHalfEven(0.5, 0)).toBe(0);
		expect(roundHalfEven(1.5, 0)).toBe(2);
	});

	it("rounds negative halves to even", () => {
		expect(roundHalfEven(-2.5, 0)).toBe(-2);
		expect(roundHalfEven(-0.125, 2)).toBe(-0.12);
	});

	it("rounds an exact binary half to even", () => {
		expect(roundHalfEven(0.125, 2)).toBe(0.12);
		expect(roundHalfEven(0.25, 1)).toBe(0.2);
	});

	/**
	 * These decimals are not exactly representable, so the stored double sits
	 * fractionally off the midpoint and there is no tie to break. Scaling by a
	 * power of ten before rounding gets these wrong.
	 */
	it("rounds by the exact value of the double, not the decimal literal", () => {
		expect(roundHalfEven(2.675, 2)).toBe(2.67);
		expect(roundHalfEven(12.345, 2)).toBe(12.35);
		expect(roundHalfEven(1.005, 2)).toBe(1);
		expect(roundHalfEven(0.135, 2)).toBe(0.14);
		expect(roundHalfEven(0.05, 1)).toBe(0.1);
		expect(roundHalfEven(0.15, 1)).toBe(0.1);
		expect(roundHalfEven(99.9995, 3)).toBe(99.999);
		expect(roundHalfEven(30.1235, 3)).toBe(30.123);
	});

	it("passes through zero and non-finite values", () => {
		expect(roundHalfEven(0, 3)).toBe(0);
		expect(roundHalfEven(Number.POSITIVE_INFINITY, 3)).toBe(
			Number.POSITIVE_INFINITY,
		);
	});
});

describe("parseFastqcData", () => {
	it("parses basic statistics, dropping the pass/fail status", () => {
		const quality = parseFastqcData(build([BASIC_STATISTICS]));

		expect(quality.count).toBe(14213);
		expect(quality.encoding).toBe("Sanger / Illumina 1.9");
		expect(quality.gc).toBe(43.5);
		expect(quality.length).toEqual([35, 151]);
	});

	it("parses a single sequence length as a pair", () => {
		const quality = parseFastqcData(
			build([
				section("Basic Statistics", "pass", [
					"#Measure\tValue",
					"Sequence length\t151",
				]),
			]),
		);

		expect(quality.length).toEqual([151, 151]);
	});

	it("rounds base quality values to three places", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence quality", "fail", [
					QUALITY_HEADER,
					"1\t31.00055\t34.0\t31.0\t34.0\t25.0\t34.0",
				]),
			]),
		);

		expect(quality.bases).toEqual([[31.001, 34, 31, 34, 25, 34]]);
	});

	it("emits one row per position in a binned range", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence quality", "pass", [
					QUALITY_HEADER,
					"1-9\t30.0\t30.0\t30.0\t30.0\t30.0\t30.0",
					"10-14\t20.0\t20.0\t20.0\t20.0\t20.0\t20.0",
				]),
			]),
		);

		expect(quality.bases).toHaveLength(14);
		expect(quality.bases.slice(9)).toEqual([
			[20, 20, 20, 20, 20, 20],
			[20, 20, 20, 20, 20, 20],
			[20, 20, 20, 20, 20, 20],
			[20, 20, 20, 20, 20, 20],
			[20, 20, 20, 20, 20, 20],
		]);
	});

	it("skips quality lines with fewer than seven fields", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence quality", "pass", [
					QUALITY_HEADER,
					"1\t30.0\t30.0",
				]),
			]),
		);

		expect(quality.bases).toEqual([]);
	});

	it("throws when base positions are not contiguous", () => {
		expect(() =>
			parseFastqcData(
				build([
					section("Per base sequence quality", "pass", [
						QUALITY_HEADER,
						"1\t30.0\t30.0\t30.0\t30.0\t30.0\t30.0",
						"3\t30.0\t30.0\t30.0\t30.0\t30.0\t30.0",
					]),
				]),
			),
		).toThrow(/Non-contiguous index/);
	});

	it("parses composition as G, A, T, C rounded to one place", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence content", "fail", [
					COMPOSITION_HEADER,
					"1\t20.44\t29.55\t30.11\t19.9",
				]),
			]),
		);

		expect(quality.composition).toEqual([[20.4, 29.6, 30.1, 19.9]]);
	});

	it("throws when composition positions are not contiguous", () => {
		expect(() =>
			parseFastqcData(
				build([
					section("Per base sequence content", "fail", [
						COMPOSITION_HEADER,
						"1\t25.0\t25.0\t25.0\t25.0",
						"5\t25.0\t25.0\t25.0\t25.0",
					]),
				]),
			),
		).toThrow(/Non-contiguous index/);
	});

	/**
	 * The whole row is replaced, not just the unparseable entries — Python scans
	 * left to right for the first value that parses and broadcasts it.
	 */
	it("replaces a row containing an unparseable value with its first parseable one", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence content", "fail", [
					COMPOSITION_HEADER,
					"1\t-\t29.5\t30.1\t19.9",
				]),
			]),
		);

		expect(quality.composition).toEqual([[29.5, 29.5, 29.5, 29.5]]);
	});

	/**
	 * FastQC emits four NaNs when a base position has no A, C, G or T at all —
	 * the percentage denominator counts only those four, so a cycle where every
	 * read is N divides zero by zero.
	 */
	it("maps an all-NaN row to zeros", () => {
		const quality = parseFastqcData(
			build([
				section("Per base sequence content", "fail", [
					COMPOSITION_HEADER,
					"1\tNaN\tNaN\tNaN\tNaN",
				]),
			]),
		);

		expect(quality.composition).toEqual([[0, 0, 0, 0]]);
	});

	/**
	 * Why zeros beat reproducing Python's `nan`: the jobs API validates
	 * this object at sample finalize and the schema rejects NaN, so a run that
	 * hit an all-N cycle would fail to store its quality at all.
	 */
	it("produces a Quality the contract accepts despite an all-NaN row", () => {
		const quality = parseFastqcData(
			build([
				BASIC_STATISTICS,
				section("Per base sequence quality", "fail", [
					QUALITY_HEADER,
					"1\t31.0\t34.0\t31.0\t34.0\t25.0\t34.0",
				]),
				section("Per base sequence content", "fail", [
					COMPOSITION_HEADER,
					"1\tNaN\tNaN\tNaN\tNaN",
				]),
				section("Per sequence quality scores", "pass", [
					"#Quality\tCount",
					"30\t1499.0",
				]),
			]),
		);

		expect(Quality.safeParse(quality).success).toBe(true);
	});

	it("throws when no value in a row can be parsed", () => {
		expect(() =>
			parseFastqcData(
				build([
					section("Per base sequence content", "fail", [
						COMPOSITION_HEADER,
						"1\t-\t-\t-\t-",
					]),
				]),
			),
		).toThrow(/Could not parse values/);
	});

	it("indexes sequence quality counts by score, truncating toward zero", () => {
		const quality = parseFastqcData(
			build([
				section("Per sequence quality scores", "pass", [
					"#Quality\tCount",
					"2\t10.0",
					"30\t1499.7",
				]),
			]),
		);

		expect(quality.sequences).toHaveLength(50);
		expect(quality.sequences[2]).toBe(10);
		expect(quality.sequences[30]).toBe(1499);
	});

	it("ignores quality scores of 50 and above", () => {
		const quality = parseFastqcData(
			build([
				section("Per sequence quality scores", "pass", [
					"#Quality\tCount",
					"49\t5.0",
					"50\t99.0",
					"93\t42.0",
				]),
			]),
		);

		expect(quality.sequences).toHaveLength(50);
		expect(quality.sequences[49]).toBe(5);
		expect(quality.sequences.filter((count) => count === 99)).toEqual([]);
	});

	/**
	 * A negative or non-numeric score would otherwise be used as an index and
	 * hang a `-1` or `NaN` property off the array, leaving 50 elements but a
	 * different shape.
	 */
	it("ignores quality scores that are negative or unparseable", () => {
		const quality = parseFastqcData(
			build([
				section("Per sequence quality scores", "pass", [
					"#Quality\tCount",
					"-1\t7.0",
					"bogus\t9.0",
					"30\t11.0",
				]),
			]),
		);

		expect(quality.sequences).toHaveLength(50);
		expect(quality.sequences[30]).toBe(11);
		expect(Object.keys(quality.sequences)).toHaveLength(50);
		expect(quality.sequences.every((count) => Number.isInteger(count))).toBe(
			true,
		);
	});

	it("ignores lines outside a section and content after END_MODULE", () => {
		const quality = parseFastqcData(
			build([["##FastQC\t0.12.1"], BASIC_STATISTICS, ["Total Sequences\t999"]]),
		);

		expect(quality.count).toBe(14213);
	});

	it("returns empty defaults when sections are missing", () => {
		const quality = parseFastqcData("##FastQC\t0.12.1\n");

		expect(quality).toEqual({
			bases: [],
			composition: [],
			count: 0,
			encoding: "",
			gc: 0,
			length: [0, 0],
			sequences: new Array(50).fill(0),
		});
	});
});

describe("compositeQuality", () => {
	const left = {
		bases: [[30, 31, 29, 33, 25, 35]],
		composition: [[20.4, 29.6, 30.1, 19.9]],
		count: 100,
		encoding: "Sanger / Illumina 1.9",
		gc: 43,
		length: [35, 151],
		sequences: [1, 2, 3],
	};

	const right = {
		bases: [[31, 31, 30, 33, 26, 35]],
		composition: [[21.4, 28.6, 30.3, 19.7]],
		count: 150,
		encoding: "ignored",
		gc: 45,
		length: [50, 140],
		sequences: [4, 5, 6],
	};

	it("averages bases and composition and sums counts", () => {
		const composite = compositeQuality(left, right);

		expect(composite.bases).toEqual([[30.5, 31, 29.5, 33, 25.5, 35]]);
		expect(composite.composition).toEqual([[20.9, 29.1, 30.2, 19.8]]);
		expect(composite.count).toBe(250);
		expect(composite.gc).toBe(44);
		expect(composite.sequences).toEqual([5, 7, 9]);
	});

	it("takes the encoding from the left", () => {
		expect(compositeQuality(left, right).encoding).toBe(
			"Sanger / Illumina 1.9",
		);
	});

	/**
	 * min/max run over the concatenation of the two pairs, not element-wise, so
	 * the composite can pair a min from one side with a max from the other.
	 */
	it("takes length as min/max over both pairs concatenated", () => {
		expect(compositeQuality(left, right).length).toEqual([35, 151]);
		expect(
			compositeQuality(
				{ ...left, length: [60, 80] },
				{ ...right, length: [40, 70] },
			).length,
		).toEqual([40, 80]);
	});

	/** Python zips with `strict=False`, so mismatched lengths truncate. */
	it("truncates to the shorter side rather than throwing", () => {
		const composite = compositeQuality(
			{ ...left, bases: [...left.bases, [10, 10, 10, 10, 10, 10]] },
			{ ...right, sequences: [4, 5] },
		);

		expect(composite.bases).toHaveLength(1);
		expect(composite.sequences).toEqual([5, 7]);
	});

	it("truncates a short row within a longer matrix", () => {
		const composite = compositeQuality(left, {
			...right,
			bases: [[31, 31]],
		});

		expect(composite.bases).toEqual([[30.5, 31]]);
	});
});
