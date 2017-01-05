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

import React from "react";
import { find } from "lodash";
import { Alert, Collapse } from "react-bootstrap";
import { formatIsolateName } from "virtool/js/utils";
import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

const getInitialState = () => ({
    error: false,
    pending: false
});

/**
 * A component used for verifying a modified virus. Contains a button for verifying the virus and can display warnings
 * rendered from a reply from the server
 *
 * @class
 */
export default class ConfirmVirus extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        _id: React.PropTypes.string,
        show: React.PropTypes.bool.isRequired,
        isolates: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    componentWillReceiveProps (nextProps) {
        // Get rid of the error display if the virus detail changes. The verification is no longer valid.
        if (this.detail != nextProps.detail) {
            this.setState({error: false});
        }
    }

    componentDidUpdate (prevProps) {
        // Only update the component is its visibility is being toggled.
        if (prevProps.show && !this.props.show) {
            this.setState(getInitialState());
        }
    }

    /**
     * Send a request to the server to verify a virus. If the verification succeeds, the detail modal will update and
     * this component will unmount. If verification fails, the onVerificationFailure handler will be called with the
     * error data from the server. Triggered by a click event on the verify button.
     *
     * @func
     */
    verify = () => {
        this.setState({pending: true}, () => {
            dispatcher.db.viruses.request(
                "verify_virus",
                {_id: this.props._id}
            ).failure((data) => {
                this.setState({
                    error: data,
                    pending: false
                });
            });
        });
    };

    render () {

        let content;

        const verifyButton = (
            <Button onClick={this.verify} disabled={this.state.pending} pullRight>
                <Icon name="checkmark" pending={this.state.pending} /> Verify
            </Button>
        );

        if (this.state.error) {
            let errors = [];

            // The virus has no isolates associated with it.
            if (this.state.error.empty_virus) {
                errors.push(
                    <li key="emptyVirus">
                        There are no isolates associated with this virus
                    </li>
                );
            }

            // The virus has an inconsistent number of sequences between isolates.
            if (this.state.error.isolate_inconsistency) {
                errors.push(
                    <li key="isolateInconsistency">
                        Some isolates have different numbers of sequences than other isolates
                    </li>
                );
            }

            // One or more isolates have no sequences associated with them.
            if (this.state.error.empty_isolate) {
                // The empty_isolate property is an array of isolate_ids of empty isolates.
                const emptyIsolates = this.state.error.empty_isolate.map((isolate_id, index) => {
                    // Get the entire isolate identified by isolate_id from the detail data.
                    const isolate = find(this.props.isolates, {isolate_id: isolate_id});

                    return (
                        <li key={index}>
                            {formatIsolateName(isolate)} <em>({isolate_id})</em>
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
            if (this.state.error.empty_sequence) {
                // Make a list of sequences that have no defined sequence field.
                const emptySequences = this.state.error.empty_sequence.map((errorObject, index) => {
                    // Get the entire isolate object identified by the isolate_id.
                    const isolate = find(this.props.isolates, {isolate_id: errorObject.isolate_id});

                    return (
                        <li key={index}>
                            <span>sequence accession </span>
                            <span>"{errorObject.sequence_id}" in isolate "{formatIsolateName(isolate)}"</span>
                        </li>
                    );
                });

                errors.push(
                    <li key="emptySequence">
                        There sequence records have undefined sequence fields:
                        <ul>{emptySequences}</ul>
                    </li>
                );
            }

            content = (
                <div>
                    <h5><strong>
                        There are some problems that must be corrected before this virus can be included in the next
                        index rebuild:
                    </strong></h5>

                    <ul>{errors}</ul>

                    {verifyButton}
                </div>
            );
        } else {
            content = (
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        This virus was modified since the last index rebuild. Verify that it is ready to be included in
                        the next rebuild.
                    </FlexItem>
                    <FlexItem grow={0} pad={15}>
                        {verifyButton}
                    </FlexItem>
                </Flex>
            );
        }

        return (
            <Collapse in={this.props.show} timeout={150}>
                <Alert bsStyle={this.state.error ? "danger": "warning"} className="clearfix">
                    {content}
                </Alert>
            </Collapse>
        );
    }

}
