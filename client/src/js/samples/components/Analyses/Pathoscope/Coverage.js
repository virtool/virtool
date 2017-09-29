import React from "react";
import PropTypes from "prop-types";
import { pick } from "lodash";
import { select } from "d3-selection";
import { area } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";

const createChart = (element, data, length, meta, yMax, xMin, showYAxis) => {

    let svg = select(element).append("svg");

    const margin = {
        top: 10,
        left: 15 + (showYAxis ? 30: 0),
        bottom: 50,
        right: 10
    };

    svg.append("text").text(yMax.toString())
        .remove();

    svg.remove();

    const height = 200 - margin.top - margin.bottom;

    let width = length / 5;

    if (width < xMin) {
        width = xMin;
    }

    width -= (margin.left + margin.right);

    const x = scaleLinear()
        .range([0, width])
        .domain([0, length]);

    const y = scaleLinear()
        .range([height, 0])
        .domain([0, yMax]);

    const xAxis = axisBottom(x);

    // Construct the SVG canvas.
    svg = select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    if (data) {
        const areaDrawer = area()
            .x((d, i) => x(i))
            .y0(d => y(d))
            .y1(height);

        svg.append("path")
            .datum(data)
            .attr("class", "depth-area")
            .attr("d", areaDrawer);
    }

    // Set-up a y-axis that will appear at the top of the chart.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "0.15em")
            .attr("transform", "rotate(-65)");

    if (showYAxis) {
        svg.append("g")
            .attr("class", "y axis")
            .call(axisLeft(y));
    }

    svg.append("text")
        .attr("class", "coverage-label small")
        .attr("transform", "translate(4,10)")
        .text(`${meta.id} - ${meta.definition}`);
};

export default class CoverageChart extends React.Component {

    static propTypes = {
        yMax: PropTypes.number,
        data: PropTypes.array,
        length: PropTypes.number,
        title: PropTypes.string,
        showYAxis: PropTypes.bool
    };

    componentDidMount () {
        window.addEventListener("resize", this.renderChart);
        this.renderChart();
    }

    componentWillUnmount () {
        window.removeEventListener("resize", this.renderChart);
    }

    renderChart = () => {

        while (this.chartNode.firstChild) {
            this.chartNode.removeChild(this.chartNode.firstChild);
        }

        createChart(
            this.chartNode,
            this.props.data,
            this.props.length,
            pick(this.props, ["id", "definition"]),
            this.props.yMax,
            this.chartNode.offsetWidth,
            this.props.showYAxis
        );
    };

    render = () => (
        <div className="coverage-chart" ref={(node) => this.chartNode = node} />
    );
}
