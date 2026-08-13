import { describe, expect, it } from "vitest";
import { compositeQuality, roundHalfEven } from "./fastqc";

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
