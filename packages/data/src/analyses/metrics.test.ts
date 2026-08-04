import { describe, expect, it } from "vitest";
import {
	coverageOf,
	maxDepthOf,
	medianDepth,
	mergeDepths,
	toDepths,
} from "./metrics";

describe("toDepths", () => {
	it("returns the alignment as written when it matches the sequence", () => {
		expect(toDepths([0, 3, 3, 1], 4)).toEqual([0, 3, 3, 1]);
	});

	it("reads a hit with no alignment as an uncovered genome", () => {
		expect(toDepths(undefined, 3)).toEqual([0, 0, 0]);
		expect(toDepths(null, 3)).toEqual([0, 0, 0]);
	});

	it("pads an alignment shorter than the sequence it names", () => {
		expect(toDepths([4, 4], 5)).toEqual([4, 4, 0, 0, 0]);
	});

	it("truncates an alignment longer than the sequence it names", () => {
		expect(toDepths([1, 2, 3, 4], 2)).toEqual([1, 2]);
	});

	it("reads a non-numeric position as no depth", () => {
		expect(toDepths([1, "two", 3], 3)).toEqual([1, 0, 3]);
	});
});

describe("medianDepth", () => {
	it("returns the middle value for an odd-length list", () => {
		expect(medianDepth([17, 18, 5, 7, 41, 52, 67, 22, 3])).toBe(18);
	});

	it("returns the mean of the middle two for an even-length list", () => {
		expect(medianDepth([17, 18, 5, 7, 41, 52, 67, 22])).toBe(20);
	});

	it("rounds a half-value to a whole number of reads", () => {
		expect(medianDepth([17, 18, 5, 7, 41, 52, 67, 21])).toBe(20);
	});

	it("returns zero for an empty list rather than NaN", () => {
		expect(medianDepth([])).toBe(0);
	});
});

describe("coverageOf", () => {
	it("returns the proportion of positions carrying a read", () => {
		expect(coverageOf([0, 1, 2, 0])).toBe(0.5);
	});

	it("returns zero when nothing was covered", () => {
		expect(coverageOf([0, 0, 0])).toBe(0);
	});

	it("returns zero for a genome of no length", () => {
		expect(coverageOf([])).toBe(0);
	});

	it("does not count a return to zero as covered", () => {
		// The lossy round trip this replaces carried the previous depth forward
		// across dropped points, which reported this profile as fully covered.
		expect(coverageOf([5, 0, 0, 0, 5])).toBe(0.4);
	});
});

describe("maxDepthOf", () => {
	it("returns the greatest depth", () => {
		expect(maxDepthOf([3, 19, 4])).toBe(19);
	});

	it("returns zero when there are no depths", () => {
		expect(maxDepthOf([])).toBe(0);
	});
});

describe("mergeDepths", () => {
	it("takes the greatest depth any isolate recorded at each position", () => {
		expect(
			mergeDepths([
				[1, 5, 5, 6],
				[7, 5, 5, 1],
				[1, 1, 2, 3],
			]),
		).toEqual([7, 5, 5, 6]);
	});

	it("spans the longest isolate when their lengths differ", () => {
		expect(
			mergeDepths([
				[1, 5, 5, 6, 3],
				[7, 5],
				[1, 1, 2],
			]),
		).toEqual([7, 5, 5, 6, 3]);
	});

	it("returns nothing when there are no isolates", () => {
		expect(mergeDepths([])).toEqual([]);
	});
});
