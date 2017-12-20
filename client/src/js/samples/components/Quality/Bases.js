import { line, area } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { min, values } from "lodash";

import { appendLegend, createSVG } from "../../chartUtils";

const series = [
    {label: "Mean", color: "#a94442"},
    {label: "Median", color: "#428bca"},
    {label: "Quartile", color: "#3C763D"},
    {label: "Decile", color: "#FFF475"}
];

const CreateBasesChart = (element, data, width) => {

    // Find the absolute minimum quality found in the data set.
    const minQuality = min(data.map(document => min(values(document))));

    const svg = createSVG(element, width);

    width = width - svg.margin.left - svg.margin.right;

    // Set up scales and axes.
    const y = scaleLinear()
        .range([svg.height, 0])
        .domain([minQuality - 5, 48]);

    const x = scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    const xAxis = axisBottom(x);

    const yAxis = axisLeft(y);

    // A function for generating the lines representing mean and median base quality.
    const lineDrawer = (data, key) => {
        const column = {
            mean: 0,
            median: 1
        }[key];

        const generator = line()
            .x((d, i) => x(i))
            .y(d => y(d[column]));

        return generator(data);
    };

    const areaX = (d, i) => x(i);

    // Define the d3 area functions to render the inter-quartile and upper and lower decile plot areas.
    const areas = [
        {
            name: "upper",
            func: area()
                .x(areaX)
                .y0(d => y(d[3]))
                .y1(d => y(d[5]))
        },
        {
            name: "lower",
            func: area()
                .x(areaX)
                .y0(d => y(d[2]))
                .y1(d => y(d[4]))
        },
        {
            name: "quartile",
            func: area()
                .x(areaX)
                .y0(d => y(d[2]))
                .y1(d => y(d[3]))
        }
    ];

    // Append the areas to the chart.
    areas.forEach(area => {
        svg.append("path")
            .attr("d", area.func(data))
            .attr("class", "graph-line")
            .style("stroke", "none")
            .style("fill", area.name === "quartile" ? "#3C763D" : "#FFF475")
            .style("opacity", 0.5);
    });

    // Append the median line to the chart. Color is blue.
    svg.append("path")
        .attr("d", lineDrawer(data, "median"))
        .attr("class", "graph-line")
        .style("stroke", "#428bca");

    // Append the median line to the chart. Color is red.
    svg.append("path")
        .attr("d", lineDrawer(data, "mean"))
        .attr("class", "graph-line")
        .style("stroke", "#a94442");

    // Append the x-axis to the chart.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${svg.height})`)
        .call(xAxis)
        .append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("class", "axis-label")
        .text("Read Position");

    // Append the y-axis to the chart.
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .text("Quality")
        .attr("dy", "10px")
        .attr("y", 6)
        .style("text-anchor", "end")
        .attr("transform", "rotate(-90)");

    appendLegend(svg, width, series);
};

export default CreateBasesChart;
