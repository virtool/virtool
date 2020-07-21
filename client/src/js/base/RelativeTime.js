import { formatDistanceStrict } from "date-fns";
import { includes } from "lodash-es";
import React, { useEffect, useState } from "react";

/**
 * Create a human readable relative time.
 *
 * It is possible that the relative time could be in the future if the browser time lags behind the server time. If this
 * is the case the string will contain the substring 'in a'. If this substring is present, return the alternative time
 * string 'just now'.
 *
 * @param time {string} the ISO formatted time
 * @returns {string}
 */
function createTimeString(time) {
    const now = Date.now();
    const timeString = formatDistanceStrict(new Date(time), now, { addSuffix: true });
    return includes(timeString, "in a") || includes(timeString, "a few") ? "just now" : timeString;
}

function useRelativeTime(time) {
    const [timeString, setTimeString] = useState(createTimeString(time));

    useEffect(() => {
        function updateTimeString() {
            const newTimeString = createTimeString(time);

            if (newTimeString !== timeString) {
                setTimeString(newTimeString);
            }
        }

        const interval = window.setInterval(updateTimeString, 8000);

        return () => {
            window.clearInterval(interval);
        };
    }, [time]);

    return timeString;
}

/**
 * Shows the passed time prop relative to the current time (eg. 3 days ago). The relative time string is updated
 * automatically as time passes.
 */
export const RelativeTime = ({ time }) => {
    const timeString = useRelativeTime(time);
    return <span>{timeString}</span>;
};
