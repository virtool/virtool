import type { Coordinate } from "@virtool/contracts";
import { area, scaleLinear } from "d3";

/**
 * Reduce the polyline to at most one point per pixel, keeping the deepest point
 * in each column.
 *
 * The server caps a curve at a point count wide enough for any chart, not for
 * this one — a chart here is often only a fraction of that width, whether
 * because it shares its container with other segments or because a column is
 * narrower than the widest chart the server sized for. This is the same
 * reduction the server applies, run again at the width actually being drawn.
 * The two cannot share a module: server code must not be reachable from the
 * browser tree.
 *
 * A column reports its deepest point, so peaks survive at the position they
 * were recorded at.
 */
export function downsample(
	align: Coordinate[],
	length: number,
	width: number,
): Coordinate[] {
	if (align.length <= width) {
		return align;
	}

	const columns = new Map<number, Coordinate>();

	for (const point of align) {
		const column = Math.min(Math.floor((point[0] / length) * width), width - 1);
		const peak = columns.get(column);

		if (peak === undefined || point[1] > peak[1]) {
			columns.set(column, point);
		}
	}

	// The points arrive in ascending x, and replacing a column's peak keeps that
	// column's insertion position, so the values are already in order.
	return [...columns.values()];
}

/**
 * Build the `d` attribute for a filled depth-of-coverage curve.
 *
 * `maxDepth` and `height` are shared across every curve drawn alongside this
 * one, so their relative depths stay comparable instead of each being scaled
 * to its own peak.
 */
export function buildDepthPath(
	align: Coordinate[],
	length: number,
	width: number,
	maxDepth: number,
	height: number,
): string {
	const points = downsample(align, length, width);

	const x = scaleLinear().range([0, width]).domain([0, length]);

	const y = scaleLinear()
		.range([height, 0])
		.domain([0, maxDepth || 1]);

	const path = area<Coordinate>()
		.x((point) => x(point[0]))
		.y0(height)
		.y1((point) => y(point[1]));

	return path(points) ?? "";
}
