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

import React from "react";
import PropTypes from "prop-types";
import Moment from "moment";
import { includes } from "lodash";

/**
 * Renders a timestamp into a readable relative time (eg. 2 hours ago). On mount it sets an interval that updates the
 * displayed time every second. This allows the relative time to be constantly accurate if the component is mounted
 * for a longer span of time.
 */
export class RelativeTime extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            timeString: this.getTimeString()
        }
    }

    static propTypes = {
        time: PropTypes.string.isRequired,
        em: PropTypes.bool
    };

    static defaultProps = {
        em: false
    };

    componentDidMount () {
        // Start the update interval when the component mounts.
        this.interval = window.setInterval(this.update, 1000);
    }

    componentWillReceiveProps (nextProps) {
        this.setState({time: nextProps.time});
    }

    shouldComponentUpdate (nextProps, nextState) {
        // Check if the time string changed. Only re-render if it has.
        return nextState !== this.state || nextProps !== this.props;
    }

    componentDidUpdate (prevProps) {
        // If the component gets a new timestamp, the time string must be immediately updated. When the component
        // updates, check the old and new props to see if the timestamp changes. Force a time string update, if props
        // did change.
        if (prevProps !== this.props) {
            this.update();
        }
    }

    componentWillUnmount () {
        // Clear the interval when the component unmounts.
        window.clearInterval(this.interval);
    }

    getTimeString = () => {
        // Make the time string using Moment.js
        const timeString = Moment(this.props.time).fromNow();

        // It is possible that the relative time could be in the future if the browser time lags behind the server time.
        // If this is the case the string will contain the substring 'in a'. If this substring is present, return the
        // alternative time string 'just now'.
        return includes(timeString, "in a") || includes(timeString, "a few") ? "just now": timeString;
    };

    update = () => {
        const newTimeString = this.getTimeString();

        if (newTimeString !== this.state.timeString) {
            this.setState({
                timeString: newTimeString
            });
        }
    };

    render () {
        return (
            <span style={this.props.em ? {fontStyle: "italic"}: null}>
                {this.state.timeString}
            </span>
        );
    }
}
