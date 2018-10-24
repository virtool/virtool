import "d3-transition";
import React from "react";
import PropTypes from "prop-types";

export default class QualityChart extends React.Component {
  static propTypes = {
    data: PropTypes.array,
    createChart: PropTypes.func
  };

  componentDidMount() {
    this.update();
    window.addEventListener("resize", this.update);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.update);
  }

  shouldComponentUpdate() {
    // Don"t ever render the component. All changes are done via d3.
    return false;
  }

  update = () => {
    // Find the chart DOM node and get its width.

    const width = this.chartNode.offsetWidth;

    // Make sure the DOM node is empty before rendering the d3 chart.
    this.chartNode.innerHTML = "";

    // Create the updated/new chart.
    this.props.createChart(this.chartNode, this.props.data, width);
  };

  render() {
    // This is the div the chart will be rendered in.
    return (
      <div className="chart-container" ref={node => (this.chartNode = node)} />
    );
  }
}
