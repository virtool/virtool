/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressBar, AutoProgressBar
 *
 */

import React from "react";
import CX from "classnames";
import { round } from "lodash";
import { bsStyles } from "./";

export class AutoProgressBar extends React.Component {

    constructor (props) {
        super(props);
        this.interval = null;
        this.state = {
            fill: 0
        };
    }

    static propTypes = {
        step: React.PropTypes.number,
        bsStyle: React.PropTypes.oneOf(bsStyles),
        active: React.PropTypes.bool,
        interval: React.PropTypes.number,
        affixed: React.PropTypes.bool
    };

    static defaultProps = {
        step: 30,
        interval: 120
    };

    componentWillReceiveProps (nextProps) {
        if (this.props.active && !nextProps.active) {
            this.stop();

            this.setState({
                fill: 100
            });
        }

        if (!this.props.active && nextProps.active) {
            this.setState({fill: 10}, () => {
                this.interval = window.setInterval(this.move, this.props.interval);
            });
        }
    }

    componentWillUnmount = () => {
        this.stop();
    };

    move = () => {
        // Calculate how far the bar should be filled for this iteration.
        const fill = this.state.fill + round(this.props.step * Math.random());

        // If the fill is more than 80% of the bar, stop iterating and wait for a prop change before moving the bar
        // again.
        if (fill >= 80) {
            this.stop();
        }

        // Update the fill so the progress bar moves.
        this.setState({
            fill: fill
        });
    };

    handleMoved = (now) => {
        if (now === 100) {
            this.setState({fill: 0});
        }
    };

    stop = () => {
        window.clearInterval(this.interval);
    };

    render () {
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
        now: React.PropTypes.number,
        onMoved: React.PropTypes.func,
        children: React.PropTypes.node,
        affixed: React.PropTypes.bool,
        style: React.PropTypes.object,
        bsStyle: React.PropTypes.oneOf(bsStyles)
    };

    static defaultProps = {
        bsStyle: "primary",
        now: 0
    };

    componentWillReceiveProps (nextProps) {
        // Listen for the bar move transition to end if the "now" prop is being changed.
        if (this.props.now !== nextProps.now) {
            this.barNode.addEventListener("transitionend", this.onTransitionend);
        }
    }

    componentWillUnmount () {
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

    render () {
        return (
            <div className={CX("progress", {"progress-affixed": this.props.affixed})} style={this.props.style}>
                <div
                    ref={(node) => this.barNode = node}
                    className={`progress-bar progress-bar-${this.props.bsStyle}`}
                    style={{width: `${this.props.now}%`}}
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
