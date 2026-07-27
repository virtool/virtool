import { describe, expect, it } from "vitest";
import { simplify, transformCoverageToCoordinates } from "./simplify";

/**
 * A quasi-random depth profile. Every position differs from both its
 * neighbours, so it survives the pre-simplification point selection intact and
 * yields one coordinate per depth.
 */
function depthProfile(length: number): number[] {
	return Array.from({ length }, (_, x) => (x * 37) % 53);
}

describe("transformCoverageToCoordinates", () => {
	it("returns nothing for an empty array", () => {
		expect(transformCoverageToCoordinates([])).toEqual([]);
	});

	it("emits a single depth twice, as python does", () => {
		expect(transformCoverageToCoordinates([5])).toEqual([
			[0, 5],
			[0, 5],
		]);
	});

	it("emits both points of a two-element array", () => {
		expect(transformCoverageToCoordinates([3, 9])).toEqual([
			[0, 3],
			[1, 9],
		]);

		expect(transformCoverageToCoordinates([0, 0])).toEqual([
			[0, 0],
			[1, 0],
		]);
	});

	it("collapses a flat array to its endpoints", () => {
		expect(transformCoverageToCoordinates([4, 4, 4, 4, 4])).toEqual([
			[0, 4],
			[4, 4],
		]);
	});

	it("collapses an all-zero array to its endpoints", () => {
		expect(transformCoverageToCoordinates(new Array(300).fill(0))).toEqual([
			[0, 0],
			[299, 0],
		]);
	});

	it("keeps interior points that differ from either neighbour", () => {
		expect(transformCoverageToCoordinates([1, 1, 1, 8, 1, 1])).toEqual([
			[0, 1],
			[2, 1],
			[3, 8],
			[4, 1],
			[5, 1],
		]);
	});

	it("passes a short profile through unsimplified", () => {
		const depths = depthProfile(40);
		const coordinates = transformCoverageToCoordinates(depths);

		expect(coordinates).toHaveLength(40);
		expect(coordinates).toEqual(depths.map((depth, x) => [x, depth]));
	});

	it("passes exactly 100 coordinates through unsimplified", () => {
		expect(transformCoverageToCoordinates(depthProfile(100))).toHaveLength(100);
	});

	it("simplifies above 100 coordinates, retaining trunc(0.4 * count)", () => {
		// 0.4 * 101 is 40.4, which the ratio path truncates rather than rounds.
		expect(transformCoverageToCoordinates(depthProfile(101))).toHaveLength(40);
		expect(transformCoverageToCoordinates(depthProfile(300))).toHaveLength(120);
		expect(transformCoverageToCoordinates(depthProfile(1000))).toHaveLength(
			400,
		);
	});

	it("retains the first point when simplifying", () => {
		const depths = depthProfile(300);

		expect(transformCoverageToCoordinates(depths)[0]).toEqual([0, depths[0]]);
	});

	it("does not retain the last point when simplifying", () => {
		// Python's ratio path selects every point clearing the threshold — always
		// at least one more than asked for — then truncates from the front, so the
		// final point is always cut. The charts have always been drawn this way.
		const coordinates = transformCoverageToCoordinates(depthProfile(300));

		expect(coordinates.at(-1)).toEqual([196, 44]);
	});

	it("retains a narrow spike", () => {
		const depths = depthProfile(300);
		depths[150] = 9999;

		const coordinates = transformCoverageToCoordinates(depths);

		expect(coordinates).toHaveLength(120);
		expect(coordinates).toContainEqual([150, 9999]);
	});

	it("matches the python implementation", () => {
		// Captured from `virtool.analyses.format.transform_coverage_to_coordinates`
		// running against visvalingamwyatt 0.3.0.
		expect(transformCoverageToCoordinates(depthProfile(120))).toEqual([
			[0, 0],
			[1, 37],
			[3, 5],
			[4, 42],
			[6, 10],
			[7, 47],
			[9, 15],
			[10, 52],
			[13, 4],
			[14, 41],
			[16, 9],
			[17, 46],
			[19, 14],
			[20, 51],
			[23, 3],
			[24, 40],
			[26, 8],
			[27, 45],
			[29, 13],
			[30, 50],
			[33, 2],
			[34, 39],
			[36, 7],
			[37, 44],
			[39, 12],
			[40, 49],
			[43, 1],
			[44, 38],
			[46, 6],
			[47, 43],
			[49, 11],
			[50, 48],
			[53, 0],
			[54, 37],
			[56, 5],
			[57, 42],
			[59, 10],
			[60, 47],
			[62, 15],
			[63, 52],
			[66, 4],
			[67, 41],
			[69, 9],
			[70, 46],
			[72, 14],
			[73, 51],
			[76, 3],
			[77, 40],
		]);
	});
});

describe("simplify", () => {
	it("returns the points unchanged when the ratio asks for all of them", () => {
		const points = depthProfile(20).map(
			(depth, x) => [x, depth] as [number, number],
		);

		expect(simplify(points, 1)).toEqual(points);
	});

	it("takes the front of the selection when every area ties", () => {
		const points = Array.from(
			{ length: 10 },
			(_, x) => [x, x * 2] as [number, number],
		);

		// Every interior point of a straight line has zero area, so the threshold
		// falls to zero and the selection is taken from the front.
		expect(simplify(points, 0.4)).toEqual([
			[0, 0],
			[1, 2],
			[2, 4],
			[3, 6],
		]);
	});
});
