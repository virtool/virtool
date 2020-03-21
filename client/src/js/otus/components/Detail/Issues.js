import { find, map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Alert } from "../../../base";
import { formatIsolateName } from "../../../utils/utils";

const StyledOTUIssues = styled(Alert)`
    h5 {
        font-weight: bold;
        margin: 0 0 15px;
    }

    ul {
        margin: 0 0 10px;
    }
`;

const OTUIssues = props => {
    const errors = [];

    // The OTU has no isolates associated with it.
    if (props.issues.empty_otu) {
        errors.push(<li key="emptyOTU">There are no isolates associated with this OTU</li>);
    }

    // The OTU has an inconsistent number of sequences between isolates.
    if (props.issues.isolate_inconsistency) {
        errors.push(
            <li key="isolateInconsistency">Some isolates have different numbers of sequences than other isolates</li>
        );
    }

    // One or more isolates have no sequences associated with them.
    if (props.issues.empty_isolate) {
        // The empty_isolate property is an array of isolate_ids of empty isolates.
        const emptyIsolates = map(props.issues.empty_isolate, (isolateId, index) => {
            // Get the entire isolate identified by isolate_id from the detail data.
            const isolate = find(props.isolates, { id: isolateId });

            return <li key={index}>{formatIsolateName(isolate)}</li>;
        });

        errors.push(
            <li key="emptyIsolate">
                There are no sequences associated with the following isolates:
                <ul>{emptyIsolates}</ul>
            </li>
        );
    }

    // One or more sequence documents have no sequence field.
    if (props.issues.empty_sequence) {
        // Make a list of sequences that have no defined sequence field.
        const emptySequences = map(props.issues.empty_sequence, (errorObject, index) => {
            // Get the entire isolate object identified by the isolate_id.
            const isolate = find(props.isolates, { id: errorObject.isolate_id });
            return (
                <li key={index}>
                    <span>
                        <em>{errorObject._id}</em> in isolate <em>{formatIsolateName(isolate)}</em>
                    </span>
                </li>
            );
        });

        errors.push(
            <li key="emptySequence">
                There are sequence records with undefined <code>sequence</code> fields:
                <ul>{emptySequences}</ul>
            </li>
        );
    }

    return (
        <StyledOTUIssues color="orange" block>
            <h5>There are some issues that must be resolved before this OTU can be included in the next index build</h5>
            <ul>{errors}</ul>
        </StyledOTUIssues>
    );
};

OTUIssues.propTypes = {
    issues: PropTypes.object,
    isolates: PropTypes.arrayOf(PropTypes.object)
};

export default OTUIssues;
