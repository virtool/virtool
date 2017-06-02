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


import React from "react";

/**
 * A React component that renders a d3 chart object.
 *
 * @class
 */
export default class QualityChart extends React.Component {

    static propTypes = {
        data: React.PropTypes.array,
        createChart: React.PropTypes.func
    };

    componentDidMount () {
        this.update();
        window.addEventListener("resize", this.update);
    }

    componentWillUnmount () {
        window.removeEventListener("resize", this.update);
    }

    static shouldComponentUpdate () {
        // Don"t ever render the component. All changes are done via d3.
        return false;
    }

    /**
     * Re-renders the d3 chart using jQuery and d3.
     *
     * @func
     */
    update = () => {
        // Find the chart DOM node and get its width.

        const width = this.chartNode.offsetWidth;

        // Make sure the DOM node is empty before rendering the d3 chart.
        this.chartNode.innerHTML = "";

        // Create the updated/new chart.
        this.props.createChart(this.chartNode, this.props.data, width);
    };

    render () {
        // This is the div the chart will be rendered in.
        return <div ref={(node) => this.chartNode = node} />;
    }

}
