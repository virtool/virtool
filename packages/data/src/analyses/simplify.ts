/**
 * Reduce a hit's per-position read depths to the polyline the coverage charts
 * draw.
 *
 * Two passes, both linear. The first is lossless: an interior position only
 * earns a coordinate where the depth changes, so a flat run collapses to the
 * points that bound it. The second caps what survives at one point per column,
 * keeping the deepest point in each — which is what bounds the payload for a
 * high-variance profile over a long genome, where the first pass alone still
 * yields thousands of coordinates.
 *
 * This replaced a port of the Visvalingam-Whyatt reduction Python performed.
 * That algorithm minimises the areal deviation of a polyline, which is the wrong
 * criterion for a coverage curve twice over: it discards narrow triangles first,
 * and on this data the narrow features — a spike, a single-position drop to zero
 * — are the whole signal. `metrics.ts` already had to derive every depth and
 * coverage figure ahead of it for that reason. It was also quadratic, taking
 * over eight seconds on a single 30 kb genome, and reduced to a *proportion* of
 * its input rather than to a point count, so it bounded nothing and the client
 * had to reduce the result a second time anyway.
 */

import type { Coordinate } from "@virtool/contracts";

/**
 * The most coordinates a curve is emitted with.
 *
 * Above the pixel width of any chart that draws one — the OTU overview splits
 * the width across a genome's segments and the isolate charts are laid out in
 * columns, so neither approaches it — which is what makes the cap invisible
 * rather than a quality setting.
 */
const MAX_COORDINATES = 2000;

/**
 * Read an array position that has already been shown to be in range.
 *
 * Every index passed below is derived from a length check in the same scope, so
 * the throw is unreachable. It exists so `noUncheckedIndexedAccess` is satisfied
 * by a check rather than by an assertion.
 */
function elementAt<T>(values: T[], index: number): T {
	const value = values[index];

	if (value === undefined) {
		throw new RangeError(`index ${index} is out of range`);
	}

	return value;
}

/**
 * Reduce a polyline to at most one point per column, keeping the deepest point
 * in each.
 *
 * A column reports its peak, so a spike survives at the position it was recorded
 * at rather than being averaged away. Nothing pins the endpoints: the rule stays
 * uniform, and a column spans a fraction of a pixel at this cap, so a curve
 * beginning at the first column's peak rather than at its first point is not a
 * visible difference. `downsample` in `PathoscopeOtuCoverage` is the same
 * reduction, applied again on the client to fit a panel — the two cannot share a
 * module, since server code must not be reachable from the browser tree.
 */
function capToColumns(coordinates: Coordinate[], cap: number): Coordinate[] {
	if (coordinates.length <= cap) {
		return coordinates;
	}

	const span = elementAt(coordinates, coordinates.length - 1)[0];

	// A polyline whose points all sit at one position has no span to divide into
	// columns. It cannot exceed the cap in the first place, so this is a guard
	// against dividing by zero rather than a case that arises.
	if (span <= 0) {
		return coordinates;
	}

	const columns = new Map<number, Coordinate>();

	for (const point of coordinates) {
		const column = Math.min(Math.floor((point[0] / span) * cap), cap - 1);
		const peak = columns.get(column);

		if (peak === undefined || point[1] > peak[1]) {
			columns.set(column, point);
		}
	}

	// The points arrive in ascending x, and replacing a column's peak keeps that
	// column's insertion position, so the values are already in order.
	return [...columns.values()];
}

/** Convert position-indexed read depths to the coordinates a chart draws. */
export function transformCoverageToCoordinates(depths: number[]): Coordinate[] {
	const [first] = depths;

	if (first === undefined) {
		return [];
	}

	const coordinates: Coordinate[] = [[0, first]];

	const last = depths.length - 1;

	// An interior point only earns a coordinate where the depth changes, so a
	// flat run collapses to the points that bound it. The loop excludes `last`,
	// which is appended unconditionally below — so a single-element input yields
	// its one point twice.
	let previous = first;

	for (let x = 1; x < last; x++) {
		const depth = elementAt(depths, x);
		const next = elementAt(depths, x + 1);

		if (depth !== previous || depth !== next) {
			coordinates.push([x, depth]);
		}

		previous = depth;
	}

	coordinates.push([last, elementAt(depths, last)]);

	return capToColumns(coordinates, MAX_COORDINATES);
}
