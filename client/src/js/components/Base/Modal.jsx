/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Modal
 */

'use strict';

var _ = require("lodash");
var React = require('react');
var ReactDOM = require('react-dom');
var Modal = require('react-bootstrap/lib/Modal');
var ProgressBar = require('react-bootstrap/lib/ProgressBar');

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
Modal.Progress = React.createClass({

    interval: null,

    propTypes: {
        step: React.PropTypes.number,
        active: React.PropTypes.bool,
        interval: React.PropTypes.number
    },

    getDefaultProps: function () {
        return {
            step: 0.3,
            interval: 120
        };
    },

    getInitialState: function () {
        return {
            fill: 0
        };
    },

    componentWillReceiveProps: function (nextProps) {
        if (this.props.active && !nextProps.active) {
            this.stop();

            ReactDOM.findDOMNode(this.refs.bar).addEventListener("transitionend", this.onTransitionend);

            this.setState({
                fill: 1
            });
        }

        if (!this.props.active && nextProps.active) {
            this.setState({
                fill: 0.1
            }, this.start);
        }
    },

    componentWillUnmount: function () {
        if (this.refs.bar) {
            ReactDOM.findDOMNode(this.refs.bar).removeEventListener("transitionend", this.onTransitionend);
        }

        this.stop();
    },

    start: function () {
        this.interval = setInterval(this.move, this.props.interval);
    },

    stop: function () {
        clearInterval(this.interval);
    },

    onTransitionend: function () {
        ReactDOM.findDOMNode(this.refs.bar).removeEventListener("transitionend", this.onTransitionend);

        this.setState({
            fill: 0
        });
    },

    move: function () {
        var fill = this.state.fill += _.round(this.props.step * Math.random());

        if (fill >= 0.8) {
            this.stop();
        }

        this.setState({
            fill: fill
        });
    },

    render: function () {

        if (this.state.fill !== 0) {
            return (
                <ProgressBar
                    ref="bar"
                    className="modal-progress"
                    now={this.state.fill * 100}
                />
            );
        }

        return <div style={{height: "4px"}} />;
    }

});

module.exports = Modal;