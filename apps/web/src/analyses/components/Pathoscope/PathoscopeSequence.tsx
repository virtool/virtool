import { pluralize } from "@app/format";
import { labelSvg } from "@samples/charting";
import type { Coordinate } from "@virtool/contracts";
import { area, axisBottom, axisLeft, format, scaleLinear, select } from "d3";
import { useEffect, useRef } from "react";
import "./area.css";

type DrawParams = {
	element: HTMLElement;
	data: Coordinate[] | null;
	label: string;
	length: number;
	yMax: number;
	xMin: number;
	maxGenomeLength: number;
	ratio: number;
};

function draw({
	element,
	data,
	label,
	length,
	yMax,
	xMin,
	maxGenomeLength,
	ratio,
}: DrawParams) {
	select(element).append("svg");

	const margin = 50;
	const height = 120;

	let width = maxGenomeLength > 800 ? maxGenomeLength / 5 : maxGenomeLength;

	if (width < xMin) {
		width = xMin;
	}

	width *= ratio;

	const x = scaleLinear().range([0, width]).domain([0, length]);
	const y = scaleLinear().range([height, 0]).domain([0, yMax]);

	select(element).selectAll("*").remove();

	const svgRoot = select(element)
		.append("svg")
		.attr("width", width + margin)
		.attr("height", height + margin);

	labelSvg(svgRoot, label);

	const svg = svgRoot.append("g").attr("transform", `translate(${margin},5)`);

	if (data) {
		const areaDrawer = area<Coordinate>()
			.x((d) => x(d[0]))
			.y0((d) => y(d[1]))
			.y1(height);

		svg
			.append("path")
			.datum(data)
			.attr("class", "depth-area")
			.attr("d", areaDrawer);
	}

	// Set up a y-axis that will appear at the top of the chart.
	svg
		.append("g")
		.attr("class", "x axis")
		.attr("transform", `translate(0,${height})`)
		.call(axisBottom(x).ticks(10))
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "-0.8em")
		.attr("dy", "0.15em")
		.attr("transform", "rotate(-65)");

	svg
		.append("g")
		.attr("class", "y axis")
		.call(axisLeft(y).ticks(4).tickFormat(format(".0s")));
}

type CoverageChartProps = {
	accession: string;
	data: Coordinate[] | null;
	definition: string;
	id: string;
	length: number;
	maxGenomeLength: number;
	ratio: number;
	yMax: number;
};

export default function PathoscopeSequence({
	accession,
	data,
	definition,
	length,
	maxGenomeLength,
	ratio,
	yMax,
}: CoverageChartProps) {
	const chartEl = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (chartEl.current) {
			draw({
				element: chartEl.current,
				data,
				label: `Read depth coverage across the ${accession} sequence, ${pluralize(length, "nucleotide")} long.`,
				length,
				yMax,
				xMin: chartEl.current.offsetWidth,
				maxGenomeLength,
				ratio,
			});
		}
	}, [accession, data, length, maxGenomeLength, ratio, yMax]);

	return (
		<div className="bg-stone-50 inline-block rounded">
			<p className="font-medium m-0 p-4 r-1 text-base text-gray-800">
				{accession} - {definition}
			</p>
			<div ref={chartEl}></div>
		</div>
	);
}
