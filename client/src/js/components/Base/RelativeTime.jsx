/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RelativeTime
 */

'use strict';

var Moment = require("moment");
var React = require("react");

/**
 * Renders a timestamp into a readable relative time (eg. 2 hours ago). On mount it sets an interval that updates the
 * displayed time every second. This allows the relative time to be constantly accurate if the component is mounted
 * for a longer span of time.
 */
var RelativeTime = React.createClass({

    propTypes: {
        time: React.PropTypes.string.isRequired,
        em: React.PropTypes.bool
    },

    getInitialState: function () {
        return {timeString: this.getTimeString()}
    },

    getDefaultProps: function () {
        return {em: false};
    },

    /**
     * Generate and return a relative timestring based on the time prop.
     *
     * @returns {string} - A relative time string.
     */
    getTimeString: function () {
        // Make the timestring using Moment.js
        var timeString = Moment(this.props.time).fromNow();

        // It is possible that the relative time could be in the future if the browser time lags behind the server time.
        // If this is the case the string will contain the substring 'in a'. If this substring is present, return the
        // alternative timestring 'just now'.
        return timeString.indexOf("in a") > -1 ? "just now": timeString;
    },

    componentDidMount: function () {
        // Start the update interval when the component mounts.
        this.interval = setInterval(this.update, 1000);
    },

    componentWillUnmount: function () {
        // Clear the interval when the component unmounts.
        clearInterval(this.interval);
    },

    componentWillReceiveProps: function (nextProps) {
        this.setState({time: nextProps.time});
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        // Check if the timestring changed. Only rerender if it has.
        return nextState !== this.state || nextProps !== this.props;
    },

    componentDidUpdate: function (prevProps) {
        // If the component gets a new timestamp, the timestring must be immediately updated. When the component
        // updates, check the old and new props to see if the timestamp changes. Force a timestring update, if props did
        // change.
        if (prevProps !== this.props) this.update();
    },

    update: function () {
        var newTimestring = this.getTimeString();
        if (newTimestring !== this.state.timeString) this.setState({timeString: newTimestring});
    },

    render: function () {
        return (
            <span style={this.props.em ? {fontStyle: 'italic'}: null}>
                {this.state.timeString}
            </span>
        );
    }
});

module.exports = RelativeTime;