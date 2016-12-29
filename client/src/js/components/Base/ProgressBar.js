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
import { round } from "lodash-es";

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
        active: React.PropTypes.bool,
        interval: React.PropTypes.number,
        progressStyle: React.PropTypes.oneOf(["modal", "list"])
    };

    static defaultProps = {
        step: 0.3,
        interval: 120
    };

    componentWillReceiveProps (nextProps) {
        if (this.props.active && !nextProps.active) {
            this.stop();

            this.setState({
                fill: 1
            });
        }

        if (!this.props.active && nextProps.active) {
            this.setState({ fill: 0.1 }, () => {
                this.interval = window.setInterval(this.move, this.props.interval);
            });
        }
    }

    componentWillUnmount () {
        this.stop();
    }

    move = () => {
        // Calculate how far the bar should be filled for this iteration.
        const fill = this.state.fill + round(this.props.step * Math.random());

        // If the fill is more than 80% of the bar, stop iterating and wait for a prop change before moving the bar
        // again.
        if (fill >= 0.8) {
            this.stop();
        }

        // Update the fill so the progress bar moves.
        this.setState({
            fill: fill
        });
    };

    stop = () => function () {
        window.clearInterval(this.interval);
    };

    render () {
        return (
            <ProgressBar
                progressStyle={this.props.progressStyle}
                now={this.state.fill * 100}
            />
        );
    }

}


export default class ProgressBar extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {};
    }

    static propTypes = {
        now: React.PropTypes.number,
        onMoved: React.PropTypes.func,
        children: React.PropTypes.element,
        progressStyle: React.PropTypes.oneOf(["modal", "list"])
    };

    static defaultProps = {
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
            this.props.onMoved(this.state.now);
        }
    };

    render () {

        const className = CX(
            "progress", {
                "progress-modal": this.props.progressStyle === "modal",
                "progress-list": this.props.progressStyle === "list"
            }
        );

        return (
            <div className={className}>
                <div
                    ref={this.barNode}
                    className="progress-bar"
                    role="progressbar"
                    ariaValuenow={this.state.now}
                    ariaValuemin="0"
                    ariaValuemax="100"
                >
                    {this.props.children}
                </div>
            </div>
        );
    }

}
