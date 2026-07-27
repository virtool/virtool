/**
 * A port of the coverage-to-coordinates transform Python performs when it
 * formats a pathoscope analysis, including the Visvalingam-Whyatt reduction it
 * borrows from the `visvalingamwyatt` package. The output has to match Python's
 * point for point while both implementations are live, so the quirks of that
 * package are reproduced deliberately rather than corrected.
 */

/** The proportion of points Visvalingam-Whyatt retains, matching Python's `ratio=0.4`. */
const RATIO = 0.4;

/** The coordinate count above which Python simplifies the polyline. */
const SIMPLIFY_ABOVE = 100;

/** An `[x, y]` point in a coverage polyline. */
export type Coordinate = [number, number];

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

function triangleArea(p1: Coordinate, p2: Coordinate, p3: Coordinate): number {
	return (
		Math.abs(
			p1[0] * (p2[1] - p3[1]) +
				p2[0] * (p3[1] - p1[1]) +
				p3[0] * (p1[1] - p2[1]),
		) / 2
	);
}

function findMinIndex(values: number[]): number {
	let minIndex = 0;
	let minValue = elementAt(values, 0);

	for (let index = 1; index < values.length; index++) {
		const value = elementAt(values, index);

		if (value < minValue) {
			minIndex = index;
			minValue = value;
		}
	}

	return minIndex;
}

/**
 * Drop the value at `index` by shifting the tail left, leaving the final slot
 * holding a copy of what preceded it.
 *
 * The Python original does this instead of deleting, so the array keeps a fixed
 * length and its dead tail is always `Infinity` — the right endpoint's area,
 * repeated. That is what stops the running minimum from ever selecting a slot
 * that has already been consumed.
 */
function shiftOut(values: number[], index: number): void {
	values.copyWithin(index, index + 1, values.length);
}

/**
 * Compute each point's effective area: the area of the triangle it forms with
 * its two neighbours, adjusted by repeatedly eliminating the smallest-area point
 * and recomputing the areas of the neighbours it leaves behind.
 *
 * The endpoints are pinned at `Infinity` so they are never eliminated. A
 * recomputed area is never allowed to fall below the area of the point that was
 * just removed: a point cannot be less significant than something already
 * discarded. Clamping keeps the recorded areas monotonic along the elimination
 * order, which is what makes a single threshold comparison equivalent to
 * replaying the elimination.
 */
function buildEffectiveAreas(points: Coordinate[]): number[] {
	const count = points.length;

	const effectiveAreas = new Array<number>(count).fill(
		Number.POSITIVE_INFINITY,
	);

	for (let index = 1; index < count - 1; index++) {
		effectiveAreas[index] = triangleArea(
			elementAt(points, index - 1),
			elementAt(points, index),
			elementAt(points, index + 1),
		);
	}

	// Fewer than three points means every point is an endpoint, so there is
	// nothing for the elimination below to remove.
	if (count < 3) {
		return effectiveAreas;
	}

	const areas = [...effectiveAreas];

	// The original indices still in play, in order. `minIndex` addresses this
	// list, not `points`.
	const live = points.map((_, index) => index);

	function livePointAt(position: number): Coordinate {
		return elementAt(points, elementAt(live, position));
	}

	let minIndex = findMinIndex(areas);
	let removedArea = elementAt(areas, minIndex);

	shiftOut(areas, minIndex);
	live.splice(minIndex, 1);

	while (removedArea < Number.POSITIVE_INFINITY) {
		// A recomputed area that had to be clamped is, by construction, the new
		// minimum, so the next point to remove is known without another scan.
		let next = 0;

		// After the splice, `minIndex` addresses the point that followed the one
		// just removed. There is nothing to its right when that is the endpoint.
		if (minIndex + 1 < live.length) {
			const rightIndex = elementAt(live, minIndex);

			let rightArea = triangleArea(
				livePointAt(minIndex - 1),
				livePointAt(minIndex),
				livePointAt(minIndex + 1),
			);

			if (rightArea <= removedArea) {
				rightArea = removedArea;
				next = minIndex;
			}

			effectiveAreas[rightIndex] = rightArea;
			areas[minIndex] = rightArea;
		}

		if (minIndex > 1) {
			let leftArea = triangleArea(
				livePointAt(minIndex - 2),
				livePointAt(minIndex - 1),
				livePointAt(minIndex),
			);

			if (leftArea <= removedArea) {
				leftArea = removedArea;
				next = minIndex - 1;
			}

			effectiveAreas[elementAt(live, minIndex - 1)] = leftArea;
			areas[minIndex - 1] = leftArea;
		}

		minIndex = next || findMinIndex(areas);

		live.splice(minIndex, 1);
		removedArea = elementAt(areas, minIndex);

		shiftOut(areas, minIndex);
	}

	return effectiveAreas;
}

/**
 * Reduce a polyline to the given proportion of its points using
 * Visvalingam-Whyatt.
 *
 * Python asks for `ratio=0.4`, and the package resolves a ratio by handing
 * `ratio * length` to its by-count path, which truncates: 0.4 retains exactly
 * `Math.trunc(0.4 * length)` points — 120 of 300, 40 of 101. The truncation is
 * load-bearing; rounding would return one more point than Python for many
 * inputs.
 *
 * Note that the last point does not survive. The package selects every point
 * whose area clears the threshold, which is always at least one point more than
 * was asked for, then truncates that selection from the front — and the last
 * point sits at the back. The charts have always been drawn this way.
 */
export function simplify(points: Coordinate[], ratio: number): Coordinate[] {
	const areas = buildEffectiveAreas(points);
	const retained = Math.trunc(ratio * areas.length);

	const descending = [...areas].sort((a, b) => b - a);

	if (retained >= descending.length) {
		return points;
	}

	const threshold = elementAt(descending, retained);

	return points
		.filter((_, index) => elementAt(areas, index) >= threshold)
		.slice(0, retained);
}

/**
 * Convert position-indexed read depths to chart coordinates, simplifying with
 * Visvalingam-Whyatt when the result exceeds 100 points.
 */
export function transformCoverageToCoordinates(depths: number[]): Coordinate[] {
	const [first] = depths;

	if (first === undefined) {
		return [];
	}

	const coordinates: Coordinate[] = [[0, first]];

	const last = depths.length - 1;

	// An interior point only earns a coordinate where the depth changes, so a
	// flat run collapses to the points that bound it. Python's `range(1, last)`
	// excludes `last`, which is appended unconditionally below — so a
	// single-element input yields its one point twice.
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

	if (coordinates.length > SIMPLIFY_ABOVE) {
		return simplify(coordinates, RATIO);
	}

	return coordinates;
}
