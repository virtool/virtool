import { axisBottom, axisLeft } from "d3-axis";
import { scaleLinear } from "d3-scale";
import { line, area } from "d3-shape";
import { forEach, map, min, values } from "lodash-es";

import { appendLegend, createSVG } from "../../samples/chartUtils";

const series = [
    { label: "Mean", color: "#a94442" },
    { label: "Median", color: "#428bca" },
    { label: "Quartile", color: "#3C763D" },
    { label: "Decile", color: "#FFF475" }
];

/**
 * @func
 * @param name
 * @param areaX
 * @param y
 * @param a
 * @param b
 */
const getArea = (name, areaX, y, a, b) => ({
    name,
    func: area()
        .x(areaX)
        .y0(d => y(d[a]))
        .y1(d => y(d[b]))
});

/**
 * @func
 * @param data
 * @returns {*}
 */
const getMinQuality = data => min(map(data, document => min(values(document))));

/**
 * Generates the lines representing mean and median base quality.
 *
 * @func
 * @param data
 * @param key
 * @param x
 * @param y
 */
const lineDrawer = (data, key, x, y) => {
    const column = {
        mean: 0,
        median: 1
    }[key];

    const generator = line()
        .x((d, i) => x(i))
        .y(d => y(d[column]));

    return generator(data);
};

const CreateBasesChart = (element, data, baseWidth) => {
    const svg = createSVG(element, baseWidth);

    const width = baseWidth - svg.margin.left - svg.margin.right;

    // Set up scales and axes.
    const y = scaleLinear()
        .range([svg.height, 0])
        .domain([getMinQuality(data) - 5, 48]);

    const x = scaleLinear().range([0, width]).domain([0, data.length]);

    const areaX = (d, i) => x(i);

    // Define the d3 area functions to render the inter-quartile and upper and lower decile plot areas.
    const areas = [
        getArea("upper", areaX, y, 3, 5),
        getArea("lower", areaX, y, 2, 4),
        getArea("quartile", areaX, y, 2, 3)
    ];

    // Append the areas to the chart.
    forEach(areas, area => {
        svg.append("path")
            .attr("d", area.func(data))
            .attr("class", "graph-line")
            .style("stroke", "none")
            .style("fill", area.name === "quartile" ? "#3C763D" : "#FFF475")
            .style("opacity", 0.5);
    });

    // Append the median line to the chart. Color is blue.
    svg.append("path")
        .attr("d", lineDrawer(data, "median", x, y))
        .attr("class", "graph-line")
        .style("stroke", "#428bca");

    // Append the median line to the chart. Color is red.
    svg.append("path").attr("d", lineDrawer(data, "mean", x, y)).attr("class", "graph-line").style("stroke", "#a94442");

    // Append the x-axis to the chart.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${svg.height})`)
        .call(axisBottom(x))
        .append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("dy", "10px")
        .attr("fill", "black")
        .attr("class", "axis-label")
        .text("Read Position");

    // Append the y-axis to the chart.
    svg.append("g")
        .attr("class", "y axis")
        .call(axisLeft(y))
        .append("text")
        .text("quality")
        .attr("dy", "10px")
        .attr("y", 6)
        .attr("fill", "black")
        .attr("class", "axis-label")
        .style("text-anchor", "end")
        .attr("transform", "rotate(-90)");

    appendLegend(svg, width, series);
};

export default CreateBasesChart;
