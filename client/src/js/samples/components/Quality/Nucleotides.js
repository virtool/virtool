import { select } from "d3-selection";
import { line, symbol, symbolSquare } from "d3-shape";
import { scaleOrdinal, scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { map, unzip } from "lodash";
import { legendColor } from "d3-svg-legend";

const margin = {
    top: 20,
    left: 60,
    bottom: 60,
    right: 20
};

const height = 300;

const series = [
    {color: "#428bca", label: "Guanine"},
    {color: "#a94442", label: "Adenine"},
    {color: "#3c763d", label: "Thymine"},
    {color: "#777", label: "Cytosine"}
];

const CreateNucleotidesChart = (element, data, baseWidth) => {

    const width = baseWidth - margin.left - margin.right;

    const y = scaleLinear()
        .range([height, 0])
        .domain([0, 100]);

    const x = scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    const xAxis = axisBottom(x);
    const yAxis = axisLeft(y);

    // Create a d3 line function for generating the four lines showing nucleotide frequency.
    const lineDrawer = line()
        .x((d, i) => x(i))
        .y(d => y(d));

    // Define a scale and d3-legend function for generating a legend.
    const legendScale = scaleOrdinal()
        .domain(map(series, "label"))
        .range(map(series, "color"));

    const legend = legendColor()
        .shape("path", symbol().type(symbolSquare).size(150)())
        .shapePadding(10)
        .scale(legendScale);

    // Generate base SVG.
    const svg = select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Append the four plot lines to the SVG.
    unzip(data).forEach((set, index) => {
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
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .append("text")
        .attr("y", "30")
        .attr("x", width / 2)
        .attr("dy", "10px")
        .attr("class", "axis-label")
        .text("Read Position");

    // Append y-axis and label.
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "10px")
        .style("text-anchor", "end")
        .text("% Composition");

    // Append legend, calling rendering function.
    svg.append("g")
        .attr("class", "legendOrdinal")
        .attr("transform", `translate(${width - 60}, 5)`)
        .call(legend);

};

export default CreateNucleotidesChart;
