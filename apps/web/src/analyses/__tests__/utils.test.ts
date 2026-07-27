import type {
	FormattedPathoscopeAnalysis,
	FormattedPathoscopeIsolate,
	FormattedPathoscopeSequence,
} from "@analyses/types";
import { at } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";
import {
	downsampleDepths,
	fillAlign,
	formatPathoscopeData,
	formatSequence,
	medianDepth,
	mergeCoverage,
} from "../utils";

describe("fillAlign()", () => {
	const align = [
		[0, 0],
		[5, 3],
		[7, 3],
		[10, 5],
		[12, 5],
		[16, 2],
		[19, 2],
		[20, 0],
	];
	const length = 20;

	it("should return array of twenty zeros when align is undefined", () => {
		const result = fillAlign({ length });
		expect(result).toEqual([
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		]);
	});

	it("should return array filled based on align when it is defined", () => {
		const result = fillAlign({ align, length });
		expect(result).toEqual([
			0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2,
		]);
	});
});

describe("formatSequence()", () => {
	it("should format a sequence record", () => {
		const align = [
			[0, 0],
			[5, 3],
			[7, 3],
			[8, 5],
			[10, 5],
		];
		const sequence = {
			align,
			foo: "bar",
			length: 11,
			pi: 0.4,
		};
		const result = formatSequence(
			sequence as unknown as FormattedPathoscopeSequence,
			3000,
		);
		expect(result).toEqual({
			align,
			filled: [0, 0, 0, 0, 0, 3, 3, 3, 5, 5, 5],
			foo: "bar",
			length: 11,
			pi: 0.4,
			reads: 1200,
		});
	});
});

describe("formatPathoscopeData()", () => {
	it("should return plain detail when [results.length=0]", () => {
		const detail = {
			foo: "bar",
			results: {
				hits: [],
			},
		};
		const result = formatPathoscopeData(
			detail as unknown as FormattedPathoscopeAnalysis,
		);
		expect(result).toEqual(detail);
	});
});

describe("medianDepth()", () => {
	it("should return the middle value for an odd-length list", () => {
		const values = [17, 18, 5, 7, 41, 52, 67, 22, 3];
		const result = medianDepth(values);
		expect(result).toBe(18);
	});

	it("should return the mean of the middle two for an even-length list", () => {
		const values = [17, 18, 5, 7, 41, 52, 67, 22];
		const result = medianDepth(values);
		expect(result).toBe(20);
	});

	it("should round a half-value up to a whole number of reads", () => {
		const values = [17, 18, 5, 7, 41, 52, 67, 21];
		const result = medianDepth(values);
		expect(result).toBe(20);
	});

	it("should return zero for an empty list", () => {
		expect(medianDepth([])).toBe(0);
	});
});

describe("mergeCoverage()", () => {
	let isolates: Pick<FormattedPathoscopeIsolate, "filled">[];

	beforeEach(() => {
		const coverages = [
			[1, 5, 5, 6, 6, 7, 9, 3, 2, 2, 1, 0, 0, 0, 1, 2, 1],
			[7, 5, 5, 1, 1, 2, 1, 5, 6, 2, 1, 0, 0, 0, 1, 3, 2],
			[1, 1, 2, 3, 4, 4, 4, 4, 2, 2, 2, 3, 2, 1, 0, 1, 0],
		];
		isolates = coverages.map((filled) => ({ filled }));
	});

	it("should return merged coverage when all isolates have same length", () => {
		const merged = mergeCoverage(isolates);
		expect(merged).toEqual([7, 5, 5, 6, 6, 7, 9, 5, 6, 2, 2, 3, 2, 1, 1, 3, 2]);
	});

	it("should return merged coverage when isolate lengths differ", () => {
		at(isolates, 0).filled.push(3);
		at(isolates, 0).filled.push(5);
		at(isolates, 2).filled.push(1);
		const merged = mergeCoverage(isolates);
		expect(merged).toEqual([
			7, 5, 5, 6, 6, 7, 9, 5, 6, 2, 2, 3, 2, 1, 1, 3, 2, 3, 5,
		]);
	});
});

describe("downsampleDepths()", () => {
	it("should return the depths unchanged when there are fewer than width", () => {
		const depths = [1, 2, 3, 4, 5];
		expect(downsampleDepths(depths, 10)).toBe(depths);
	});

	it("should return the depths unchanged when the width is zero", () => {
		const depths = [1, 2, 3, 4, 5];
		expect(downsampleDepths(depths, 0)).toBe(depths);
	});

	it("should return the depths unchanged when the width is negative", () => {
		const depths = [1, 2, 3, 4, 5];
		expect(downsampleDepths(depths, -1)).toBe(depths);
	});

	it("should return the depths unchanged when the width equals the depth count", () => {
		const depths = [1, 2, 3, 4, 5];
		expect(downsampleDepths(depths, depths.length)).toBe(depths);
	});

	it("should return an empty array when there are no depths", () => {
		expect(downsampleDepths([], 10)).toEqual([]);
	});

	it("should return one bucket per pixel when there are more depths than width", () => {
		const depths = Array.from({ length: 1000 }, (_, index) => index);
		expect(downsampleDepths(depths, 200)).toHaveLength(200);
	});

	it("should take the maximum depth in each bucket", () => {
		const depths = [1, 2, 3, 4, 5, 6, 7, 8];
		expect(downsampleDepths(depths, 4)).toEqual([2, 4, 6, 8]);
	});

	it("should preserve a peak that a sampling downsample would skip", () => {
		const depths = [0, 0, 0, 0, 0, 900, 0, 0, 0, 0];
		expect(downsampleDepths(depths, 5)).toEqual([0, 0, 900, 0, 0]);
	});
});
