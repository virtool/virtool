import React from "react";
import Moment from "moment";
import PropTypes from "prop-types";

window.relativeTimeCallbacks = [];

window.setInterval(1000, () => {
    window.relativeTimeCallbacks.forEach(callback => callback());
});

export class RelativeTime extends React.Component {

    constructor (props) {
        super(props);
        this.state = {timeString: this.getTimeString()};
    }

    static propTypes = {
        time: PropTypes.string.isRequired
    };

    componentWillMount () {
        window.relativeTimeCallbacks.push(this.update);
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
        const index = window.relativeTimeCallbacks.indexOf(this.update);

        if (index !== -1) {
            window.relativeTimeCallbacks.splice(index, 1);
        }
    }

    getTimeString = () => {
        // Make the time string using Moment.js
        const timeString = Moment(this.props.time).fromNow();

        // It is possible that the relative time could be in the future if the browser time lags behind the server time.
        // If this is the case the string will contain the substring 'in a'. If this substring is present, return the
        // alternative time string 'just now'.
        return timeString.includes("in a") || timeString.includes("a few") ? "just now" : timeString;
    };

    update = () => {
        const newTimeString = this.getTimeString();

        if (newTimeString !== this.state.timeString) {
            this.setState({timeString: newTimeString});
        }
    };

    render () {
        return <span>{this.state.timeString}</span>;
    }
}
