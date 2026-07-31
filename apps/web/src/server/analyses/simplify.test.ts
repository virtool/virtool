import { describe, expect, it } from "vitest";
import { transformCoverageToCoordinates } from "./simplify";

/**
 * A quasi-random depth profile. Every position differs from both its
 * neighbours, so it survives the change-point pass intact and yields one
 * coordinate per depth.
 */
function depthProfile(length: number): number[] {
	return Array.from({ length }, (_, x) => (x * 37) % 53);
}

describe("transformCoverageToCoordinates", () => {
	it("returns nothing for an empty array", () => {
		expect(transformCoverageToCoordinates([])).toEqual([]);
	});

	it("emits a single depth twice", () => {
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

	it("passes a profile under the cap through untouched", () => {
		const depths = depthProfile(2000);
		const coordinates = transformCoverageToCoordinates(depths);

		expect(coordinates).toEqual(depths.map((depth, x) => [x, depth]));
	});

	it("caps a profile above the cap at one point per column", () => {
		expect(
			transformCoverageToCoordinates(depthProfile(2001)).length,
		).toBeLessThanOrEqual(2000);
		expect(
			transformCoverageToCoordinates(depthProfile(50_000)).length,
		).toBeLessThanOrEqual(2000);
	});

	it("emits coordinates in ascending position", () => {
		const coordinates = transformCoverageToCoordinates(depthProfile(50_000));

		for (let index = 1; index < coordinates.length; index++) {
			expect(coordinates[index]?.[0]).toBeGreaterThan(
				coordinates[index - 1]?.[0] as number,
			);
		}
	});

	it("keeps a narrow spike at the position it was recorded at", () => {
		const depths = depthProfile(50_000);
		depths[31_337] = 9999;

		expect(transformCoverageToCoordinates(depths)).toContainEqual([
			31_337, 9999,
		]);
	});

	it("keeps the deepest point of each column, not the first", () => {
		// A flat genome with one deeper position per 100-position block. The change
		// -point pass keeps far more than the cap, so every surviving coordinate is
		// its column's peak.
		const depths = new Array<number>(500_000).fill(1);

		for (let x = 50; x < depths.length; x += 100) {
			depths[x] = 100 + (x % 7);
		}

		const coordinates = transformCoverageToCoordinates(depths);

		expect(coordinates.length).toBeLessThanOrEqual(2000);
		expect(coordinates.every(([, depth]) => depth >= 100)).toBe(true);
	});

	it("spans the full width of the genome", () => {
		const coordinates = transformCoverageToCoordinates(depthProfile(50_000));

		// The first and last columns are not pinned, so the curve is allowed to
		// start and stop short — but only by the width of one column.
		const columnWidth = 50_000 / 2000;

		expect(coordinates[0]?.[0]).toBeLessThan(columnWidth);
		expect(coordinates.at(-1)?.[0]).toBeGreaterThan(49_999 - columnWidth);
	});

	it("reduces a long high-variance profile in linear time", () => {
		const depths = depthProfile(1_000_000);

		const start = performance.now();
		transformCoverageToCoordinates(depths);
		const elapsed = performance.now() - start;

		// The Visvalingam-Whyatt reduction this replaced was quadratic and took
		// over eight seconds on 30 kb. A generous ceiling here still fails by
		// orders of magnitude if a quadratic pass is reintroduced.
		expect(elapsed).toBeLessThan(2000);
	});
});
