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

'use strict';

var d3 = require('d3');
var Numeral = require("numeral");

/**
 * A function that create a chart showing abundance of reads with different mean quality scores.
 *
 * @param element - the element in which to render the chart.
 * @param data - the data used to render the chart.
 * @param width - the width of the element the chart will be rendered in.
 * @function
 */
var CreateSequencesChart = function (element, data, width) {

    // Set the base dimensions of the chart.
    var margin = {
        top: 20,
        left: 60,
        bottom: 60,
        right: 20
    };

    var height = 300;
    width = width - margin.left - margin.right;

    /**
     * A function for formatting integer read counts into readable scientific notation.
     *
     * @param number {number} - the integer to format.
     * @returns {string} - the passed number formatted in scientific notation.
     */
    var formatter = function (number) {
        number = number.toExponential().split('e');
        return Numeral(number[0]).format('0.0') + 'ₑ' + number[1].replace('+', '');
    };

    // Set up scales.
    var y = d3.scale.linear()
        .range([height, 0])
        .domain([0, _.max(data)]);

    var x = d3.scale.linear()
        .range([0, width])
        .domain([0, data.length]);

    // Set up scales. Use formatter function to make scientific notation tick labels for y-axis.
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left')
        .tickFormat(formatter);

    // Build a d3 line function for rendering the plot line.
    var line = d3.svg.line()
        .x(function (d,i) {return x(i);})
        .y(function (d) {return y(d);});

    // Build SVG canvas.
    var svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Append the plot line to the SVG.
    svg.append('path')
        .attr('d', line(data))
        .attr('class', 'graph-line');

    // Append a labelled x-axis to the SVG.
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(' + 0 + ',' + height + ')')
        .call(xAxis)
        .append('text')
        .attr('y', '30')
        .attr('x', width / 2)
        .attr('dy', '10px')
        .attr('class', 'axis-label')
        .text('Read Quality');

    // Append a labelled y-axis to the SVG. The label is on the plot-side of the axis and is oriented vertically.
    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '10px')
        .style('text-anchor', 'end')
        .text('Read Count');
};

module.exports = CreateSequencesChart;