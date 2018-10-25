import { line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { max } from "lodash-es";
import { createSVG } from "../../chartUtils";
import { toScientificNotation } from "../../../utils";

const CreateSequencesChart = (element, data, baseWidth) => {
    const svg = createSVG(element, baseWidth);

    const width = baseWidth - svg.margin.right - svg.margin.left;

    // Set up scales.
    const y = scaleLinear()
        .range([svg.height, 0])
        .domain([0, max(data)]);

    const x = scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    // Set up scales. Use formatter function to make scientific notation tick labels for y-axis.
    const xAxis = axisBottom(x);

    const yAxis = axisLeft(y).tickFormat(toScientificNotation);

    // Build a d3 line function for rendering the plot line.
    const lineDrawer = line()
        .x((d, i) => x(i))
        .y(d => y(d));

    // Append the plot line to the SVG.
    svg.append("path")
        .attr("d", lineDrawer(data))
        .attr("class", "graph-line");

    // Append a labelled x-axis to the SVG.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${svg.height})`)
        .call(xAxis)
        .append("text")
        .attr("y", "30")
        .attr("x", width / 2)
        .attr("dy", "10px")
        .attr("class", "axis-label")
        .attr("fill", "black")
        .text("Read Quality");

    // Append a labelled y-axis to the SVG. The label is on the plot-side of the axis and is oriented vertically.
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "10px")
        .attr("fill", "black")
        .attr("class", "axis-label")
        .style("text-anchor", "end")
        .text("Read Count");
};

export default CreateSequencesChart;
