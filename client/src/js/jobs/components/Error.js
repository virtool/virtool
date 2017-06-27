/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobError
 */

import React from "react";
import { Alert } from "react-bootstrap";

/**
 * A render-only panel that displays the error information for a failed job.
 */
const JobError = (props) => {
        
    // The content to place inside the error panel.
    let content;

    if (props.error.context.indexOf("External") === -1) {
        // Traceback from a Python exception.
        const tracebackLines = props.error.message.traceback.map((line, index) =>
            <div key={index} className="traceback-line">{line}</div>
        );

        // Only show a colon and exception detail after the exception name if there is detail present.
        let details;

        if (props.error.message.details.length > 0) {
            details = <span>: {props.error.message.details}</span>
        }

        // Content replicates format of Python exceptions shown in Python console.
        content = (
            <div>
                <div>Traceback (most recent call last):</div>
                {tracebackLines}
                <p>{props.error.message.type}{details}</p>
            </div>
        );
    } else {
        // An error in an external application.
        content = props.error.message.map(line => <p>{line}</p>);
    }

    return (
        <Alert bsStyle="danger">
            <h5><strong>{props.error.context}</strong></h5>
            {content}
        </Alert>
    );
};

JobError.propTypes = {
    error: React.PropTypes.object.isRequired
};

export default JobError;
