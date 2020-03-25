import { axisBottom, axisLeft } from "d3-axis";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { forEach, unzip } from "lodash-es";

import { appendLegend, createSVG } from "../../samples/chartUtils";

const series = [
    { color: "#428bca", label: "Guanine" },
    { color: "#a94442", label: "Adenine" },
    { color: "#3c763d", label: "Thymine" },
    { color: "#777", label: "Cytosine" }
];

const CreateNucleotidesChart = (element, data, baseWidth) => {
    const svg = createSVG(element, baseWidth);

    const width = baseWidth - svg.margin.left - svg.margin.right;

    const y = scaleLinear().range([svg.height, 0]).domain([0, 100]);

    const x = scaleLinear().range([0, width]).domain([0, data.length]);

    // Create a d3 line function for generating the four lines showing nucleotide frequency.
    const lineDrawer = line()
        .x((d, i) => x(i))
        .y(d => y(d));

    // Append the four plot lines to the SVG.
    forEach(unzip(data), (set, index) => {
        svg.append("path")
            .attr("d", () => lineDrawer(set))
            .attr("stroke", () => series[index].color)
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("data-legend", () => series[index].label);
    });

    // Append x-axis and label.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${svg.height})`)
        .call(axisBottom(x))
        .append("text")
        .attr("y", "30")
        .attr("x", width / 2)
        .attr("dy", "10px")
        .attr("class", "axis-label")
        .attr("fill", "black")
        .text("Read Position");

    // Append y-axis and label.
    svg.append("g")
        .attr("class", "y axis")
        .call(axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "10px")
        .attr("fill", "black")
        .attr("class", "axis-label")
        .style("text-anchor", "end")
        .text("% Composition");

    appendLegend(svg, width, series);
};

export default CreateNucleotidesChart;
