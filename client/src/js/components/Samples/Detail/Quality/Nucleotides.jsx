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
var Legend = require('d3-svg-legend/no-extend');

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

    var y = d3.scale.linear()
        .range([height, 0])
        .domain([0, 100]);

    var x = d3.scale.linear()
        .range([0, width])
        .domain([0, data.length]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

    // Create a d3 line function for generating the four lines showing nucleotide frequency.
    var line = d3.svg.line()
        .x(function (d, i) { return x(i)} )
        .y(function (d) { return y(d) });

    var series = [
        {column: 0, color: '#428bca', label: 'Guanine'},
        {column: 1, color: '#a94442', label: 'Adenine'},
        {column: 2, color: '#3c763d', label: 'Thymine'},
        {column: 3, color: '#777', label: 'Cytosine'}
    ];

    // Define a scale and d3-legend function for generating a legend.
    var legendScale = d3.scale.ordinal()
        .domain(_.map(series, 'label'))
        .range(_.map(series, 'color'));

    var legend = Legend.color()
        .shape('path', d3.svg.symbol().type('square').size(150)())
        .shapePadding(10)
        .scale(legendScale);

    // Defines 4 data layers to render in the chart.
    var layers = series.map(function (set) {
        // Get the nucleotide frequency values for the base. (x=position, y=frequency).
        var values = data.map(function (point) {
            return point[set.column];
        });

        return {
            label: set.label,
            color: set.color,
            values: values
        };
    });

    // Create stack layout for plot lines.
    var stack = d3.layout.stack()
        .values(function (d) {
            return d.values;
        });

    // Generate base SVG.
    var svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Append the four plot lines to the SVG.
    svg.selectAll('path')
        .data(stack(layers))
        .enter().append('path')
        .attr('d', function (d) {
            return line(d.values);
        })
        .attr('stroke', (function (d) {
            return d.color;
        }))
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('data-legend', function (d) {
            return d.label;
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