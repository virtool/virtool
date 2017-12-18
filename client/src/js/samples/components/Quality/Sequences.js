import { select } from "d3-selection";
import { line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { max } from "lodash";
import Numeral from "numeral";

const formatter = (number) => {
    number = number.toExponential().split("e");
    return Numeral(number[0]).format("0.0") + "E" + number[1].replace("+", "");
};

const height = 300;

const margin = {
    top: 20,
    left: 60,
    bottom: 60,
    right: 20
};

const CreateSequencesChart = (element, data, baseWidth) => {

    const width = baseWidth - margin.left - margin.right;

    // Set up scales.
    const y = scaleLinear()
        .range([height, 0])
        .domain([0, max(data)]);

    const x = scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    // Set up scales. Use formatter function to make scientific notation tick labels for y-axis.
    const xAxis = axisBottom(x);

    const yAxis = axisLeft(y).tickFormat(formatter);

    // Build a d3 line function for rendering the plot line.
    const lineDrawer = line()
        .x((d, i) => x(i))
        .y(d => y(d));

    // Build SVG canvas.
    const svg = select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Append the plot line to the SVG.
    svg.append("path")
        .attr("d", lineDrawer(data))
        .attr("class", "graph-line");

    // Append a labelled x-axis to the SVG.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .append("text")
        .attr("y", "30")
        .attr("x", width / 2)
        .attr("dy", "10px")
        .attr("class", "axis-label")
        .text("Read Quality");

    // Append a labelled y-axis to the SVG. The label is on the plot-side of the axis and is oriented vertically.
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "10px")
        .style("text-anchor", "end")
        .text("Read Count");
};

export default CreateSequencesChart;
