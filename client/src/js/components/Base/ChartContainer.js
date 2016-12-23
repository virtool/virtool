import React from "react";
import ReactDOM from "react-dom";

export default class ChartContainer extends React.Component {

    constructor (props) {
        super(props);
    }

    componentDidMount () {
        window.onresize = this.renderChart;
        this.renderChart();
    }

    componentWillUnmount () {
        // Remove the d3 chart.
        window.removeEventListener('resize', this.renderChart);
    }

    shouldComponentUpdate (nextProps) {
        // Don't re-render the chart element. Instead, call the chart's update function with the new props.
        this.chart.update(nextProps);
        return false;
    }

    renderChart = () => {
        let element = ReactDOM.findDOMNode(this);
        element.innerHTML = '';
        this.chart = new this.props.chart(element, this.props);
    }

    render () {
        return (
            <div className="chart-container"></div>
        );
    }

}