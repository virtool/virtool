import React from "react";
import PropTypes from "prop-types";
import { select } from "d3-selection";
import { area } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { Button } from "../../../../base";

const createChart = (element, data, length, meta, yMax, xMin, showYAxis) => {

    let svg = select(element).append("svg");

    const margin = {
        top: 10,
        left: 15 + (showYAxis ? 30 : 0),
        bottom: 50,
        right: 10
    };

    svg.append("text").text(yMax.toString())
        .remove();

    svg.remove();

    const height = 200 - margin.top - margin.bottom;

    let width = length > 800 ? length / 5 : length;

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
            .x(d => x(d[0]))
            .y0(d => y(d[1]))
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
        id: PropTypes.string,
        definition: PropTypes.string,
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

        const { id, definition } = this.props;

        createChart(
            this.chartNode,
            this.props.data,
            this.props.length,
            { id, definition },
            this.props.yMax,
            this.chartNode.offsetWidth,
            this.props.showYAxis
        );
    };

    handleClick = () => {

        const doctype = "<?xml version='1.0' standalone='no'?>"
        + "<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'>";

        select(this.chartNode).select("svg").select("path").node()
            .setAttribute("fill", "#428bca");

        const svg = (new XMLSerializer()).serializeToString(select(this.chartNode).select("svg").node());

        const blob = new Blob([ doctype + svg ], { type: "image/svg+xml;charset=utf-8" });

        const url = window.URL.createObjectURL(blob);

        const width = select(this.chartNode).select("svg").attr("width");
        const height = select(this.chartNode).select("svg").attr("height");

        const img = document.createElement("img");
        img.width = width;
        img.height = height;

        const filename = select(this.chartNode).select("svg").selectAll("text").filter(".coverage-label").text();

        img.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const canvasUrl = canvas.toDataURL("image/png");
            const canvasImg = document.createElement("img");
            canvasImg.width = width;
            canvasImg.height = height;
            canvasImg.src = canvasUrl;

            const a = document.createElement("a");
            a.href = canvasUrl;
            a.download = filename;

            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        img.src = url;
    }

    render () {
        return (
            <div>
                <div className="coverage-chart" ref={(node) => this.chartNode = node} />
                <Button bsStyle="primary" pullRight onClick={this.handleClick}>
                    Download PNG
                </Button>
            </div>
        );
    }
}
