var d3 = require("d3");
var React = require("react");
var ReactDOM = require("react-dom");
var ChartContainer = require("virtool/js/components/Base/ChartContainer.jsx");

var createChart = function (element, data, meta, yMax, xMin, showYAxis) {

    var svg = d3.select(element).append('svg');

    var maxWidth = 0;

    svg.append("text").text(yMax.toString())
        .each(function () {maxWidth = this.getBBox().width})
        .remove();

    svg.remove();

    var margin = {
        top: 10,
        left: maxWidth + (showYAxis ? 15: 0),
        bottom: 50,
        right: 10
    };

    var height = 200 - margin.top - margin.bottom;
    var width = data.length / 8;

    if (width < xMin) width = xMin;

    width -= (margin.left + margin.right);

    var x = d3.scaleLinear()
        .range([0, width])
        .domain([0, data.length]);

    var y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, yMax]);

    var xAxis = d3.axisBottom(x);

    var area = d3.area()
        .x(function (d, i) {return x(i)})
        .y0(function (d) {return y(d)})
        .y1(height);

    // Construct the SVG canvas.
    svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append("path")
        .datum(data)
        .attr("class", "depth-area")
        .attr("d", area);

    // Set-up a y-axis that will appear at the top of the chart.
    svg.append('g')
        .attr('class', 'x axis')
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "0.15em")
            .attr("transform", "rotate(-65)");

    if (showYAxis) {
        var yAxis = d3.axisLeft(y);

        svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis);
    }

    svg.append('text')
        .attr('class', 'coverage-label small')
        .attr("transform", "translate(4,10)")
        .text(meta.accession + ' - ' + meta.definition);
};


var CoverageChart = React.createClass({

    propTypes: {
        yMax: React.PropTypes.number
    },

    componentDidMount: function () {
        window.addEventListener("resize", this.renderChart);
        this.renderChart();
    },

    componentWillUnmount: function () {
        window.removeEventListener("resize", this.renderChart);
    },

    renderChart: function () {
        var node = ReactDOM.findDOMNode(this.refs.chart);

        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }

        var xMin = ReactDOM.findDOMNode(this.props.isolateComponent).offsetWidth;

        var meta = _.pick(this.props, ["accession", "definition"]);

        createChart(node, this.props.data, meta, this.props.yMax, xMin, this.props.showYAxis);
    },

    render: function () {
        return (
            <span style={{marginTop: "5px"}} className="coverage-chart">
                <div>{this.props.title}</div>
                <div ref="chart" />
            </span>
        )
    }

});

module.exports = CoverageChart;