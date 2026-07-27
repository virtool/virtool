import { useElementSize } from "@app/hooks";
import type { Coordinate } from "@virtool/contracts";
import { area, max, scaleLinear } from "d3";

const height = 60;

/**
 * Reduce the polyline to at most one point per pixel, keeping the deepest point
 * in each column.
 *
 * The server simplifies a curve to a proportion of its points rather than to a
 * point count, so a high-variance profile over a long genome still arrives as
 * thousands of coordinates. Every hit draws this overview in its accordion
 * trigger, so an analysis with many OTUs would otherwise put hundreds of
 * thousands of segments in the document while all of them are still collapsed.
 *
 * A column reports its deepest point, so peaks survive at the position they
 * were recorded at.
 */
function downsample(
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

function buildDepthPath(
	align: Coordinate[],
	length: number,
	width: number,
): string {
	const points = downsample(align, length, width);

	const x = scaleLinear().range([0, width]).domain([0, length]);
	const y = scaleLinear()
		.range([height, 0])
		.domain([0, max(points, (point) => point[1]) || 1]);

	const path = area<Coordinate>()
		.x((point) => x(point[0]))
		.y0(height)
		.y1((point) => y(point[1]));

	return path(points) ?? "";
}

type OtuCoverageProps = {
	/** The OTU's isolate curves merged into one polyline */
	align: Coordinate[];

	/** The genome length the polyline spans, which fixes the horizontal scale */
	length: number;
};

export default function PathoscopeOtuCoverage({
	align,
	length,
}: OtuCoverageProps) {
	const [ref, { width }] = useElementSize<HTMLDivElement>();

	const drawable = width > 0 && align.length > 0 && length > 0;
	const d = drawable ? buildDepthPath(align, length, width) : "";

	return (
		<div className="bg-blue-50 pt-2" ref={ref}>
			<svg
				width={width}
				height={height}
				role="img"
				aria-label="Read depth across the reference genome"
			>
				<title>Read depth across the reference genome</title>
				{d && <path className="fill-blue-500" d={d} />}
			</svg>
		</div>
	);
}
