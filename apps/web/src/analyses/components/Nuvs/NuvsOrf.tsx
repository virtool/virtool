import Badge from "@base/Badge";
import { labelSvg } from "@samples/charting";
import { Link } from "@tanstack/react-router";
import type { NuvsOrfHit, NuvsOrf as NuvsOrfType } from "@virtool/contracts";
import { scaleLinear, select } from "d3";
import { useEffect, useRef } from "react";

const HEIGHT = 8;

/**
 * The horizontal inset the chart is drawn at, in pixels.
 *
 * The label above the chart is padded by the same amount so the two line up, so
 * this is a chart geometry constant rather than a design value — hence a literal
 * shared with the d3 transform rather than a spacing token.
 */
const INSET = 15;

function OrfLabel({ hmm }: { hmm?: NuvsOrfHit }) {
	if (hmm) {
		return (
			<Link
				className="capitalize"
				to="/hmms/$hmmId"
				params={{ hmmId: String(hmm.hit) }}
			>
				{hmm.names[0]}
			</Link>
		);
	}

	return <span>Unannotated</span>;
}

function draw(
	element: HTMLElement,
	maxLength: number,
	pos: number[],
	strand: number,
) {
	element.innerHTML = "";

	const width = element.offsetWidth - INSET * 2;

	const [first = 0, second = 0] = pos;

	const start = Math.min(first, second);
	const end = Math.max(first, second);
	const label = `Open reading frame from position ${start} to ${end} on the ${strand === 1 ? "forward" : "reverse"} strand.`;

	// Construct the SVG canvas.
	const svg = select(element)
		.append("svg")
		.attr("width", width + INSET * 2)
		.attr("height", HEIGHT);

	labelSvg(svg, label);

	// Create a mother group that will hold all chart elements.
	const group = svg.append("g").attr("transform", `translate(${INSET},0)`);

	// Set up a y-axis that will appear at the top of the chart.
	const x = scaleLinear().range([0, width]).domain([0, maxLength]);

	const x0 = x(Math.abs(strand === 1 ? first : second));
	const x1 = x(Math.abs(strand === 1 ? second : first));
	const x2 = x1 + (strand === 1 ? -5 : 5);

	const yBase = HEIGHT - 4;

	const d = [
		`M${x0},${yBase + 2}`,
		`L${x2},${yBase + 2}`,
		`L${x1},${yBase}`,
		`L${x2},${yBase - 2}`,
		`L${x0},${yBase - 2}`,
	].join(" ");

	group.append("path").attr("d", d).attr("stroke-width", 1);
}

type NuvsOrfProps = Pick<NuvsOrfType, "hits" | "pos" | "strand"> & {
	maxSequenceLength: number;
};

export default function NuvsOrf({
	hits,
	maxSequenceLength,
	pos,
	strand,
}: NuvsOrfProps) {
	const chartEl = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (chartEl.current) {
			draw(chartEl.current, maxSequenceLength, pos, strand);
		}
	}, [strand, pos, maxSequenceLength]);

	const hmm = hits[0];

	return (
		<div className="pb-3">
			<div
				className="flex font-medium items-center gap-4 py-3"
				style={{ paddingLeft: INSET }}
			>
				<OrfLabel hmm={hmm} />
				<span className="flex gap-2">
					<Badge>{(pos[1] ?? 0) - (pos[0] ?? 0)}</Badge>
					<span className="text-emerald-700">{hmm ? hmm.full_e : null}</span>
				</span>
			</div>

			<div ref={chartEl} />
		</div>
	);
}
