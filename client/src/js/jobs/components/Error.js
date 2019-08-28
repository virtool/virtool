import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { DangerAlert } from "../../base";

const StyledJobError = styled(DangerAlert)`
    display: block;
`;

const JobErrorDetails = styled.span`
    display: inline-block;
    word-break: break-word;
`;

export const JobError = ({ error }) => {
    if (error) {
        // Traceback from a Python exception.
        const tracebackLines = map(error.traceback, (line, index) => <div key={index}>{line}</div>);

        // Only show a colon and exception detail after the exception name if there is detail present.
        const details = error.details.length ? <JobErrorDetails>: {error.details}</JobErrorDetails> : null;

        // Content replicates format of Python exceptions shown in Python console.
        return (
            <StyledJobError>
                <div>Traceback (most recent call last):</div>
                {tracebackLines}
                <p>
                    {error.type}
                    {details}
                </p>
            </StyledJobError>
        );
    }

    return null;
};

export default JobError;
