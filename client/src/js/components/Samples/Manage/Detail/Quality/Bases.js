/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports BasesChart
 */

import * as d3 from "d3";
import { min, values } from "lodash-es";
import * as Legend from "d3-svg-legend";

/**
 * A function for creating a chart showing the distribution of base quality at each position in a libraries reads.
 *
 * @param element - the element in which to render the chart.
 * @param data {array} - the data used to render the chart.
 * @param width {number} - the width of the element to render in.
 * @func
 */
const CreateBasesChart = (element, data, width) => {

    const margin = {
        top: 20,
        left: 60,
        bottom: 60,
        right: 20
    };

    // Find the absolute minimum quality found in the data set.
    const minQuality = min(data.map(document => min(values(document))));

    const height = 300;

    width = width - margin.left - margin.right;

    // Set up scales and axes.
    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([minQuality - 5, 48]);

    const x = d3.scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    const xAxis = d3.axisBottom(x);

    const yAxis = d3.axisLeft(y);

    // A function for generating the lines representing mean and median base quality.
    const line = function (data, key) {
        const column = {
            mean: 0,
            median: 1
        }[key];

        const generator = d3.line()
            .x(function (d, i) {return x(i);})
            .y(function (d) {return y(d[column]);});

        return generator(data);
    };

    // Define the d3 area functions to render the inter-quartile and upper and lower decile plot areas.
    const areas = [
        {
            name: "upper",
            func: d3.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d[3]);})
                .y1(function (d) {return y(d[5]);})
        },
        {
            name: "lower",
            func: d3.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d[2]);})
                .y1(function (d) {return y(d[4]);})
        },
        {
            name: "quartile",
            func: d3.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d[2]);})
                .y1(function (d) {return y(d[3]);})
        }
    ];

    // Create base SVG canvas.
    let svg = d3.select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Append the areas to the chart.
    areas.forEach(function (area) {
        svg.append("path")
            .attr("d", area.func(data))
            .attr("class", "graph-line")
            .style("stroke", "none")
            .style("fill", area.name === "quartile" ? "#3C763D": "#FFF475")
            .style("opacity", 0.5);
    });

    // Define a scale and a d3-legend for rendering a legend on the chart.
    const legendScale = d3.scaleOrdinal()
        .domain(["Mean", "Median", "Quartile", "Decile"])
        .range(["#a94442", "#428bca", "#3C763D", "#FFF475"]);

    const legend = Legend.legendColor()
        .shape("path", d3.symbol().type(d3.symbolSquare).size(150))
        .shapePadding(10)
        .scale(legendScale);

    // Append the legend to the chart.
    svg.append("g")
        .attr("class", "legendOrdinal")
        .attr("transform", "translate(" + (width - 60) + ", 5)")
        .call(legend);

    // Append the median line to the chart. Color is blue.
    svg.append("path")
        .attr("d", line(data, "median"))
        .attr("class", "graph-line")
        .style("stroke", "#428bca");

    // Append the median line to the chart. Color is red.
    svg.append("path")
        .attr("d", line(data, "mean"))
        .attr("class", "graph-line")
        .style("stroke", "#a94442");

    // Append the x-axis to the chart.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + 0 + "," + height + ")")
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
};

export default CreateBasesChart;
