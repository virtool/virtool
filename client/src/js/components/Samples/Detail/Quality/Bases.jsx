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

'use strict';

var _ = require('lodash');
var d3 = require('d3');
var Legend = require('d3-svg-legend/no-extend');

/**
 * A function for creating a chart showing the distribution of base quality at each position in a libraries reads.
 *
 * @param element - the element in which to render the chart.
 * @param data {array} - the data used to render the chart.
 * @param width {number} - the width of the element to render in.
 * @func
 */
var CreateBasesChart = function (element, data, width) {

    var margin = {
        top: 20,
        left: 60,
        bottom: 60,
        right: 20
    };

    // Find the absolute minimum quality found in the data set.
    var minQuality = _.min(data.map(function (document) {
        return _.min(_.values(document));
    }));

    var height = 300;
    width = width - margin.left - margin.right;

    // Set up scales and axes.
    var y = d3.scale.linear()
        .range([height, 0])
        .domain([minQuality - 5, 48]);

    var x = d3.scale.linear()
        .range([0, width])
        .domain([0, data.length]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

    // A function for generating the lines representing mean and median base quality.
    var line = function (data, key) {
        var generator = d3.svg.line()
            .x(function (d, i) {return x(i);})
            .y(function (d) {return y(d[key]);});

        return generator(data);
    };

    // Define the d3 area functions to render the inter-quartile and upper and lower decile plot areas.
    var areas = [
        {
            name: 'upper',
            func: d3.svg.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d.upper);})
                .y1(function (d) {return y(d['90%']);})
        },
        {
            name: 'lower',
            func: d3.svg.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d.lower);})
                .y1(function (d) {return y(d['10%']);})
        },
        {
            name: 'quartile',
            func: d3.svg.area()
                .x(function (d, i) { return x(i);})
                .y0(function (d) {return y(d.lower);})
                .y1(function (d) {return y(d.upper);})
        }
    ];

    // Create base SVG canvas.
    var svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Append the areas to the chart.
    areas.forEach(function (area) {
        svg.append('path')
            .attr('d', area.func(data))
            .attr('class', 'graph-line')
            .style('stroke', 'none')
            .style('fill', area.name === 'quartile' ? '#3C763D': '#FFF475')
            .style('opacity', 0.5);
    });

    // Define a scale and a d3-legend for rendering a legend on the chart.
    var legendScale = d3.scale.ordinal()
        .domain(['Mean', 'Median', 'Quartile', 'Decile'])
        .range(['#a94442', '#428bca', '#3C763D', '#FFF475']);

    var legend = Legend.color()
        .shape('path', d3.svg.symbol().type('square').size(150)())
        .shapePadding(10)
        .scale(legendScale);

    // Append the legend to the chart.
    svg.append('g')
        .attr('class', 'legendOrdinal')
        .attr('transform', 'translate(' + (width - 60) + ', 5)')
        .call(legend);

    // Append the median line to the chart. Color is blue.
    svg.append('path')
        .attr('d', line(data, 'median'))
        .attr('class', 'graph-line')
        .style('stroke', '#428bca');

    // Append the median line to the chart. Color is red.
    svg.append('path')
        .attr('d', line(data, 'mean'))
        .attr('class', 'graph-line')
        .style('stroke', '#a94442');

    // Append the x-axis to the chart.
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(' + 0 + ',' + height + ')')
        .call(xAxis)
        .append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('class', 'axis-label')
        .text('Read Position');

    // Append the y-axis to the chart.
    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis)
        .append('text')
        .text('Quality')
        .attr('dy', '10px')
        .attr('y', 6)
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-90)');
};

module.exports = CreateBasesChart;