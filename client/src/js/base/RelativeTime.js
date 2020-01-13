import React from "react";
import { formatDistanceStrict } from "date-fns";
import PropTypes from "prop-types";
import { includes } from "lodash-es";

/**
 * Shows the passed time prop relative to the current time (eg. 3 days ago). The relative time string is updated
 * automatically as time passes.
 */
export class RelativeTime extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            time: this.props.time,
            timeString: this.getTimeString()
        };
    }

    static propTypes = {
        time: PropTypes.string.isRequired
    };

    componentDidMount() {
        this.interval = window.setInterval(this.update, 8000);
    }

    static getDerivedStateFromProps(nextProps) {
        return { time: nextProps.time };
    }

    shouldComponentUpdate(nextProps, nextState) {
        // Check if the time string changed. Only re-render if it has.
        return nextState.timeString !== this.state.timeString || nextProps.time !== this.props.time;
    }

    componentDidUpdate(prevProps) {
        // If the component gets a new timestamp, the time string must be immediately updated. When the component
        // updates, check the old and new props to see if the timestamp changes. Force a time string update, if props
        // did change.
        if (prevProps.time !== this.props.time) {
            this.update();
        }
    }

    componentWillUnmount() {
        window.clearInterval(this.interval);
    }

    getTimeString = () => {
        // Make the time string using Moment.js
        const timeString = formatDistanceStrict(new Date(this.props.time), Date.now(), { addSuffix: true });
        // It is possible that the relative time could be in the future if the browser time lags behind the server time.
        // If this is the case the string will contain the substring 'in a'. If this substring is present, return the
        // alternative time string 'just now'.
        return includes(timeString, "in a") || includes(timeString, "a few") ? "just now" : timeString;
    };

    update = () => {
        const newTimeString = this.getTimeString();

        if (newTimeString !== this.state.timeString) {
            this.setState({ timeString: newTimeString });
        }
    };

    render() {
        return <span>{this.state.timeString}</span>;
    }
}
