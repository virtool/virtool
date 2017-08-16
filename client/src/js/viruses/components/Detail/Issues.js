/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ConfirmVirus
 */

import React, { PropTypes } from "react";
import { find } from "lodash";
import { Alert } from "react-bootstrap";
import { formatIsolateName } from "virtool/js/utils";

const VirusIssues = (props) => {

    const errors = [];

    // The virus has no isolates associated with it.
    if (props.issues.empty_virus) {
        errors.push(
            <li key="emptyVirus">
                There are no isolates associated with this virus
            </li>
        );
    }

    // The virus has an inconsistent number of sequences between isolates.
    if (props.issues.isolate_inconsistency) {
        errors.push(
            <li key="isolateInconsistency">
                Some isolates have different numbers of sequences than other isolates
            </li>
        );
    }

    // One or more isolates have no sequences associated with them.
    if (props.issues.empty_isolate) {
        // The empty_isolate property is an array of isolate_ids of empty isolates.
        const emptyIsolates = props.issues.empty_isolate.map((isolateId, index) => {
            // Get the entire isolate identified by isolate_id from the detail data.
            const isolate = find(props.isolates, {id: isolateId});

            return (
                <li key={index}>
                    {formatIsolateName(isolate)}
                </li>
            );
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
        const emptySequences = props.issues.empty_sequence.map((errorObject, index) => {
            // Get the entire isolate object identified by the isolate_id.
            const isolate = find(props.isolates, {id: errorObject.isolate_id});

            return (
                <li key={index}>
                    <span><em>{errorObject._id}</em> in isolate <em>{formatIsolateName(isolate)}</em></span>
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
        <Alert bsStyle={props.issues ? "danger": "warning"} className="clearfix">
            <h5>
                <strong>
                    There are some issues that must be resolved before this virus can be included in the next index
                    build
                </strong>
            </h5>

            <ul>{errors}</ul>
        </Alert>
    );

};

VirusIssues.propTypes = {
    issues: PropTypes.object,
    isolates: PropTypes.arrayOf(PropTypes.object)
};

export default VirusIssues;
