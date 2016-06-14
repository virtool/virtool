var d3 = require("d3");
var React = require("react");
var ReactDOM = require("react-dom");
var ChartContainer = require("virtool/js/components/Base/ChartContainer.jsx");

var createChart = function (element, data) {

    var svg = d3.select(element).append('svg');

    var maxLabel = d3.max(data).toString();
    var maxWidth = 0;

    svg.append("text").text(maxLabel)
        .each(function () {maxWidth = this.getBBox().width})
        .remove();

    svg.remove();

    var margin = {
        top: 10,
        left: maxWidth + 15,
        bottom: 50,
        right: 10
    };

    var height = 200 - margin.top - margin.bottom;
    var width = element.offsetWidth - margin.left - margin.right;

    var x = d3.scale.linear()
        .range([0, width])
        .domain([0, data.length]);

    var y = d3.scale.linear()
        .range([height, 0])
        .domain([0, d3.max(data)]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var area = d3.svg.area()
        .x(function (d, i) {return x(i)})
        .y(function (d) {return y(d)})
        .y0(height);

    // Contruct the SVG canvas.
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

    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis);
};


var CoverageChart = React.createClass({

    componentDidMount: function () {
        window.onresize = this.renderChart;
        this.renderChart();
    },

    componentWillUnmount: function() {
        // Remove the d3 chart.
        window.removeEventListener('resize', this.renderChart);
    },

    renderChart: function () {
        createChart(ReactDOM.findDOMNode(this), this.props.data);
    },

    render: function () {
        return <div className="coverage-chart"></div>;
    }

});

module.exports = CoverageChart;