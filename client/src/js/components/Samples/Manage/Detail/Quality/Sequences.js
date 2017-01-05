/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports CreateSequencesChart
 */

import * as d3 from "d3";
import { max } from "lodash-es";
import Numeral from "numeral";

const margin = {
    top: 20,
    left: 60,
    bottom: 60,
    right: 20
};

const height = 300;

/**
 * A function that create a chart showing abundance of reads with different mean quality scores.
 *
 * @param element - the element in which to render the chart.
 * @param data - the data used to render the chart.
 * @param baseWidth - the width of the element the chart will be rendered in.
 * @function
 */
const CreateSequencesChart = (element, data, baseWidth) => {

    const width = baseWidth - margin.left - margin.right;

    /**
     * A function for formatting integer read counts into readable scientific notation.
     *
     * @param number {number} - the integer to format.
     * @returns {string} - the passed number formatted in scientific notation.
     */
    const formatter = (number) => {
        number = number.toExponential().split("e");
        return Numeral(number[0]).format("0.0") + "ₑ" + number[1].replace("+", "");
    };

    // Set up scales.
    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, max(data)]);

    const x = d3.scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    // Set up scales. Use formatter function to make scientific notation tick labels for y-axis.
    const xAxis = d3.axisBottom(x);

    const yAxis = d3.axisLeft(y).tickFormat(formatter);

    // Build a d3 line function for rendering the plot line.
    const line = d3.line()
        .x(function (d,i) {return x(i);})
        .y(function (d) {return y(d);});

    // Build SVG canvas.
    let svg = d3.select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Append the plot line to the SVG.
    svg.append("path")
        .attr("d", line(data))
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
