/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMFiles
 */

import React from "react";
import { forIn } from "lodash";
import { Alert } from "react-bootstrap";
import { numberToWord } from "virtool/js/utils"
import { Icon, Flex, FlexItem, Button } from "virtool/js/components/Base";

function makeSpecifier (value, noun) {
    return [(value === 1 ? "is": "are"), numberToWord(value), noun + (value === 1 ? "": "s")].join(" ")
}

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
function HMMErrors (props) {

    let errorComponents = [];

    forIn(props.errors, (value, error) => {

        let message;

        let alertStyle = "danger";

        let button = (
            <Button onClick={props.retrieveFiles}>
                <Icon name="reset"/> Refresh
            </Button>
        );

        if (error === "hmm_dir" && value) {
            message = "The HMM directory could not be found.";
        }

        if (error === "hmm_file" && value) {
            message = (
                <span>
                    <strong>The file <code>vFam.hmm</code> could not be found. </strong>
                    Please add it to the HMM data directory and refresh to see changes.
                </span>
            );
        }

        if (error === "press" && value) {
            message = (
                <span>
                    <strong>One or more pressed HMM files are missing. </strong>
                    Repairing this problem will call <code>hmmpress</code> on the existing HMM files.
                </span>
            );

            button = (
                <FlexItem grow={0} shrink={0} pad={15}>
                    <Button disabled={props.pressing || props.cleaning} onClick={props.press}>
                        <Icon name="hammer" pending={props.pressing} /> Repair
                    </Button>
                </FlexItem>
            );
        }

        if (error === "not_in_database" && value) {
            message = (
                <span>
                    <strong>
                        There {makeSpecifier(value.length, "profiles")} in the HMM file that do not have annotations in
                        the database.
                    </strong>
                    <span>
                        Ensure the annotation database and HMM file match. This cannot be done automatically.
                    </span>
                </span>
            );
        }

        if (error === "not_in_file" && value) {
            alertStyle = "warning";

            message = (
                <span>
                    <strong>
                        There are {makeSpecifier(value.length, "annotation")} in the database for which no profiles
                        exist in the HMM file.
                    </strong>
                    <span>
                        Repairing this problem will remove extra annotations from the database.
                    </span>
                </span>
            );

            button = (
                <FlexItem grow={0} shrink={0} pad={30}>
                    <Button disabled={props.pressing || props.cleaning} onClick={props.clean}>
                        <Icon name="hammer" pending={props.cleaning} /> Repair
                    </Button>
                </FlexItem>
            );
        }

        if (message) {
            errorComponents.push(
                <Alert
                    key={error}
                    bsStyle={alertStyle}
                    className={error === "hmm_file" || error === "hmm_dir" ? "no-margin": null}
                >
                    <Flex alignItems="center">
                        <FlexItem grow={1} shrink={1}>
                            {message}
                        </FlexItem>

                        {button}
                    </Flex>
                </Alert>
            );
        }
    });

    return (
        <div>
            {props.files.length > 0 ? <h5><strong>Errors</strong></h5>: null}
            {errorComponents}
        </div>
    );
}

HMMErrors.propTypes = {
    files: React.PropTypes.array,
    errors: React.PropTypes.object,
    cleaning: React.PropTypes.bool
};

export default HMMErrors;
