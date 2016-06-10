var React = require("react");
var ReactDOM = require('react-dom');

var ChartContainer = React.createClass({

    componentDidMount: function () {
        window.onresize = this.renderChart;
        this.renderChart();
    },

    componentWillUnmount: function() {
        // Remove the d3 chart.
        window.removeEventListener('resize', this.renderChart);
    },

    shouldComponentUpdate: function (nextProps) {
        // Don't re-render the chart element. Instead, call the chart's update function with the new props.
        this.chart.update(nextProps);
        return false;
    },

    renderChart: function () {
        var element = ReactDOM.findDOMNode(this);
        element.innerHTML = '';
        this.chart = new this.props.chart(element, this.props);
    },

    render: function () {
        return (
            <div className="chart-container"></div>
        );
    }

});

module.exports = ChartContainer;