/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports CreateNucleotidesChart
 */

'use strict';

var _ = require('lodash');
var d3 = require('d3');
var Legend = require('d3-svg-legend');

/**
 * A function for creating a chart showing the frequency of a given nucleotide at each position in a libraries reads.
 *
 * @param element - the element in which to render the chart.
 * @param data {array} - the data used to render the chart.
 * @param width {number} - the width of the element to render in.
 * @func
 */
var CreateNucleotidesChart = function (element, data, width) {

    var margin = {
        top: 20,
        left: 60,
        bottom: 60,
        right: 20
    };

    var height = 300;

    width = width - margin.left - margin.right;

    var y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, 100]);

    var x = d3.scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    var xAxis = d3.axisBottom(x);
    var yAxis = d3.axisLeft(y);

    // Create a d3 line function for generating the four lines showing nucleotide frequency.
    var line = d3.line()
        .x(function (d, i) { return x(i)} )
        .y(function (d) { return y(d) });

    var series = [
        {color: '#428bca', label: 'Guanine'},
        {color: '#a94442', label: 'Adenine'},
        {color: '#3c763d', label: 'Thymine'},
        {color: '#777', label: 'Cytosine'}
    ];

    // Define a scale and d3-legend function for generating a legend.
    var legendScale = d3.scaleOrdinal()
        .domain(_.map(series, 'label'))
        .range(_.map(series, 'color'));

    var legend = Legend.legendColor()
        .shape('path', d3.symbol().type(d3.symbolSquare).size(150)())
        .shapePadding(10)
        .scale(legendScale);

    // Generate base SVG.
    var svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Append the four plot lines to the SVG.
    _.unzip(data).forEach(function (set, index) {
        svg.append('path')
            .attr('d', function () {
                return line(set);
            })
            .attr('stroke', (function (d) {
                return series[index].color;
            }))
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('data-legend', function (d) {
                return series[index].label;
            });
    });

    // Append x-axis and label.
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(' + 0 + ',' + height + ')')
        .call(xAxis)
        .append('text')
        .attr('y', '30')
        .attr('x', width / 2)
        .attr('dy', '10px')
        .attr('class', 'axis-label')
        .text('Read Position');

    // Append y-axis and label.
    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '10px')
        .style('text-anchor', 'end')
        .text('% Composition');

    // Append legend, calling rendering function.
    svg.append('g')
        .attr('class', 'legendOrdinal')
        .attr('transform', 'translate(' + (width - 60) + ', 5)')
        .call(legend);

};

module.exports = CreateNucleotidesChart;