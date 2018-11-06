import React from "react";
import { map } from "lodash-es";

import { Alert } from "../../base";

const JobError = ({ error }) => {
    if (!error) {
        return null;
    }

    // Traceback from a Python exception.
    const tracebackLines = map(error.traceback, (line, index) => (
        <div key={index} className="traceback-line">
            {line}
        </div>
    ));

    // Only show a colon and exception detail after the exception name if there is detail present.
    const details = error.details.length ? (
        <span style={{ display: "inline-block", wordBreak: "break-word" }}>: {error.details}</span>
    ) : null;

    // Content replicates format of Python exceptions shown in Python console.
    return (
        <Alert bsStyle="danger">
            <div>Traceback (most recent call last):</div>
            {tracebackLines}
            <p>
                {error.type}
                {details}
            </p>
        </Alert>
    );
};

export default JobError;
