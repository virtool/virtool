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
import PropTypes from "prop-types";
import { Alert } from "react-bootstrap";

/**
 * A render-only panel that displays the error information for a failed job.
 */
const JobError = (props) => {

    // Traceback from a Python exception.
    const tracebackLines = props.error.traceback.map((line, index) =>
        <div key={index} className="traceback-line">{line}</div>
    );

    // Only show a colon and exception detail after the exception name if there is detail present.
    let details;

    if (props.error.details.length > 0) {
        details = <span>: {props.error.details}</span>
    }

    // Content replicates format of Python exceptions shown in Python console.
    return (
        <Alert bsStyle="danger">
            <div>Traceback (most recent call last):</div>
            {tracebackLines}
            <p>{props.error.type}{details}</p>
        </Alert>

    );
};

JobError.propTypes = {
    error: PropTypes.object.isRequired
};

export default JobError;
