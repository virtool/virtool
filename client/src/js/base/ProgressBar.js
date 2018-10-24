import React from "react";
import PropTypes from "prop-types";
import CX from "classnames";
import { round } from "lodash-es";
import { bsStyles } from "./utils";

/**
 *
 */
export class AutoProgressBar extends React.Component {
  constructor(props) {
    super(props);
    this.interval = null;
    this.state = {
      fill: 0,
      active: this.props.active
    };
  }

  static propTypes = {
    step: PropTypes.number,
    bsStyle: PropTypes.oneOf(bsStyles),
    active: PropTypes.bool,
    interval: PropTypes.number,
    affixed: PropTypes.bool
  };

  static defaultProps = {
    step: 30,
    interval: 120
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (prevState.active && !nextProps.active) {
      return { fill: 100, active: nextProps.active };
    }

    if (!prevState.active && nextProps.active) {
      return { fill: 10, active: nextProps.active };
    }

    return null;
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.fill !== prevState.fill && this.state.fill === 10) {
      this.interval = window.setInterval(this.move, this.props.interval);
    }

    if (!this.props.active && prevState.active) {
      this.stop();
    }
  }

  componentWillUnmount() {
    this.stop();
  }

  move = () => {
    // Calculate how far the bar should be filled for this iteration.
    const fill = this.state.fill + round(this.props.step * Math.random());

    // If the fill is more than 80% of the bar, stop iterating and wait for a prop change before moving the bar
    // again.
    if (fill >= 80) {
      this.stop();
    }

    // Update the fill so the progress bar moves.
    this.setState({ fill });
  };

  handleMoved = now => {
    if (now === 100) {
      this.setState({ fill: 0 });
    }
  };

  stop = () => {
    window.clearInterval(this.interval);
  };

  render() {
    if (this.state.fill === 0) {
      return <div className="progress-affixed-empty" />;
    }

    return (
      <ProgressBar
        affixed={this.props.affixed}
        now={this.state.fill}
        bsStyle={this.props.bsStyle}
        onMoved={this.handleMoved}
      />
    );
  }
}

export class ProgressBar extends React.PureComponent {
  static propTypes = {
    now: PropTypes.number,
    onMoved: PropTypes.func,
    children: PropTypes.node,
    affixed: PropTypes.bool,
    style: PropTypes.object,
    bsStyle: PropTypes.oneOf(bsStyles)
  };

  static defaultProps = {
    bsStyle: "primary",
    now: 0
  };

  componentDidUpdate(prevProps) {
    // Listen for the bar move transition to end if the "now" prop is being changed.
    if (prevProps.now !== this.props.now) {
      this.barNode.addEventListener("transitionend", this.onTransitionend);
    }
  }

  componentWillUnmount() {
    this.barNode.removeEventListener("transitionend", this.onTransitionend);
  }

  onTransitionend = () => {
    // Stop listening for the transition end once it is complete. Only listen again if the "now" prop changes.
    this.barNode.removeEventListener("transitionend", this.onTransitionend);

    // Call the onMoved callback with the new "now" prop once the bar is done moving.
    if (this.props.onMoved) {
      this.props.onMoved(this.props.now);
    }
  };

  render() {
    return (
      <div
        className={CX("progress", { "progress-affixed": this.props.affixed })}
        style={this.props.style}
      >
        <div
          ref={node => (this.barNode = node)}
          className={`progress-bar progress-bar-${this.props.bsStyle}`}
          style={{ width: `${this.props.now}%` }}
          role="progressbar"
          aria-valuenow={`${this.props.now}`}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}
