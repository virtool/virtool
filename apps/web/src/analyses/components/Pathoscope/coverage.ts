import type { Coordinate } from "@virtool/contracts";
import { area, scaleLinear } from "d3";
import type { ReactNode } from "react";

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

/** The horizontal space left between one panel and the next. */
export const gap = 6;

/** The horizontal space left between the outermost panels and the border. */
const gutter = 4;

/**
 * The narrowest panel that carries both a label and its length, in rem.
 *
 * The caption it has to fit is sized in rem, so this is too. Held in px it
 * would be right at the default preference and wrong at every other, letting a
 * panel just over the bar draw a length too wide to sit inside it — the length
 * does not shrink, so it spills into the panel alongside.
 */
const lengthMinWidth = 7.5;

// The ceiling is read at a glance against the curve below it, so it is rounded
// hard rather than given the exact figure the depth column already carries.
export function formatDepth(depth: number): string {
	if (depth < 1000) {
		return String(depth);
	}

	const [divisor, suffix] = depth < 1_000_000 ? [1000, "k"] : [1_000_000, "M"];

	return `${(depth / divisor).toFixed(1).replace(/\.0$/, "")}${suffix}`;
}

/** One panel of a coverage chart: the curve to draw, and its caption. */
export type CoveragePanel = {
	/** The coverage polyline to draw, or null/empty to draw nothing */
	align: Coordinate[] | null;

	/** A unique, stable key for the panel */
	key: string;

	/** The caption drawn below the panel; empty to reserve the space without text */
	label: string;

	/** The formatted length drawn after the label; empty to draw none */
	lengthLabel: string;

	/** The span of the reference this panel covers, which fixes its share of the chart */
	length: number;

	/**
	 * Detail revealed in a popover when the panel is activated.
	 *
	 * A panel that has one becomes a button covering both its curve and its
	 * caption; a panel without one is inert.
	 */
	detail?: ReactNode;
};

/** A coverage panel with the width and padding the chart gives it. */
export type Panel = CoveragePanel & {
	padLeft: number;
	padRight: number;
	width: number;
};

// Each panel takes the share of the chart its length is of the whole reference,
// so a position is the same number of nucleotides wide in every panel, and in
// every other chart laid out against the same reference — which is what lets an
// OTU's overview and each of its isolates' charts, and every isolate's charts
// against each other, be read against one another.
//
// The gutter is taken out of that share and handed to the outermost panels as
// padding, rather than held on the box: a panel's hover styling covers its own
// padding, where a gutter on the box leaves a strip inside the border that no
// panel covers and that stays unhighlighted while the panel beside it is
// hovered.
export function layOutPanels(panels: CoveragePanel[], width: number): Panel[] {
	const total = panels.reduce((sum, panel) => sum + panel.length, 0);

	if (total === 0) {
		return [];
	}

	const available = Math.max(0, width - gap * (panels.length - 1) - gutter * 2);

	return panels.map((panel, index) => ({
		...panel,
		padLeft: index === 0 ? gutter : 0,
		padRight: index === panels.length - 1 ? gutter : 0,
		width: (available * panel.length) / total,
	}));
}

// A panel with no label has nothing else to identify it, so it keeps its length
// at any width rather than be left with a blank caption.
export function showsLength(panel: Panel, rootFontSize: number): boolean {
	return (
		Boolean(panel.lengthLabel) &&
		(!panel.label || panel.width >= lengthMinWidth * rootFontSize)
	);
}
