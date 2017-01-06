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
export default class JobError extends React.PureComponent {

    static propTypes = {
        error: React.PropTypes.object.isRequired
    };

    render () {
        
        // The content to place inside the error panel.
        let content;

        if (this.props.error.context.indexOf("External") === -1) {
            // Traceback from a Python exception.
            const tracebackLines = this.props.error.message.traceback.map((line, index) =>
                <div key={index} className="traceback-line">{line}</div>
            );

            // Only show a colon and exception detail after the exception name if there is detail present.
            let details;

            if (this.props.error.message.details.length > 0) {
                details = <span>: {this.props.error.message.details}</span>
            }

            // Content replicates format of Python exceptions shown in Python console.
            content = (
                <div>
                    <div>Traceback (most recent call last):</div>
                    {tracebackLines}
                    <p>{this.props.error.message.type}{details}</p>
                </div>
            );
        } else {
            // An error in an external application.
            content = this.props.error.message.map(function (line) {
                return <p>{line}</p>
            });
        }

        return (
            <Alert bsStyle="danger">
                <h5><strong>{this.props.error.context}</strong></h5>
                {content}
            </Alert>
        );
    }
}
