/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports QualityChart
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

/**
 * A React component that renders a d3 chart object.
 *
 * @class
 */
var QualityChart = React.createClass({

    componentDidMount: function () {
        this.update();
        window.addEventListener("resize", this.update);
    },

    componentWillUnmount: function () {
        window.removeEventListener('resize', this.update);
    },

    shouldComponentUpdate: function () {
        // Don't ever render the component. All changes are done via d3.
        return false;
    },

    /**
     * Re-renders the d3 chart using jQuery and d3.
     *
     * @func
     */
    update: function () {
        // Find the chart DOM node and get its width.
        var element = ReactDOM.findDOMNode(this);
        var width = element.offsetWidth;

        // Make sure the DOM node is empty before rendering the d3 chart.
        element.innerHTML = '';

        // Create the updated/new chart.
        this.props.createChart(element, this.props.data, width);
    },

    render: function () {
        // This is the div the chart will be rendered in.
        return (
            <div></div>
        );
    }

});

module.exports = QualityChart;