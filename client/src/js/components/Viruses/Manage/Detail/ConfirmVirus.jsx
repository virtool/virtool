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

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Collapse = require('react-bootstrap/lib/Collapse');

var Utils = require('virtool/js/Utils');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A component used for verifying a modified virus. Contains a button for verifying the virus and can display warnings
 * rendered from a reply from the server
 *
 * @class
 */
var ConfirmVirus = React.createClass({

    propTypes: {
        // Should the component be shown. Will be true if the virus has been modified and not verified.
        show: React.PropTypes.bool.isRequired,
        detail: React.PropTypes.object.isRequired
    },

    getInitialState: function () {
        return {
            error: false,
            pending: false
        };
    },

    componentWillReceiveProps: function (nextProps) {
        // Get rid of the error display if the virus detail changes. The verification is no longer valid.
        if (this.detail != nextProps.detail) this.setState({error: false});
    },

    componentDidUpdate: function (prevProps) {
        // Only update the component is its visibility is being toggled.
        if (prevProps.show && !this.props.show) this.setState(this.getInitialState());
    },

    /**
     * Send a request to the server to verify a virus. If the verification succeeds, the detail modal will update and
     * this component will unmount. If verification fails, the onVerificationFailure handler will be called with the
     * error data from the server. Triggered by a click event on the verify button.
     *
     * @func
     */
    verify: function () {
        this.setState({pending: true}, function () {
            dispatcher.db.viruses.request(
                'verify_virus',
                {_id: this.props.detail._id}
            ).failure(function (data) {
                this.setState({
                    error: data,
                    pending: false
                });
            }, this);
        });
    },

    render: function () {
        var content;

        var verifyButton = (
            <PushButton onClick={this.verify} disabled={this.state.pending} pullRight>
                <Icon name='checkmark' pending={this.state.pending} /> Verify
            </PushButton>
        );

        if (this.state.error) {
            var errors = [];

            // The virus has no isolates associated with it.
            if (this.state.error.empty_virus) {
                errors.push(
                    <li key='emptyVirus'>
                        There are no isolates associated with this virus
                    </li>
                );
            }

            // The virus has an inconsistent number of sequences between isolates.
            if (this.state.error.isolate_inconsistency) {
                errors.push(
                    <li key='isolateInconsistency'>
                        Some isolates have different numbers of sequences than other isolates
                    </li>
                );
            }

            // One or more isolates have no sequences associated with them.
            if (this.state.error.empty_isolate) {
                // The empty_isolate property is an array of isolate_ids of empty isolates.
                var emptyIsolates = this.state.error.empty_isolate.map(function (isolate_id, index) {
                    // Get the entire isolate identified by isolate_id from the detail data.
                    var isolate = _.find(this.props.detail.isolates, {isolate_id: isolate_id});

                    return (
                        <li key={index}>
                            {Utils.formatIsolateName(isolate)} <em>({isolate_id})</em>
                        </li>
                    );
                }, this);

                errors.push(
                    <li key='emptyIsolate'>
                        There are no sequences associated with the following isolates:
                        <ul>{emptyIsolates}</ul>
                    </li>
                );
            }

            // One or more sequence documents have no sequence field.
            if (this.state.error.empty_sequence) {
                // Make a list of sequences that have no defined sequence field.
                var emptySequences = this.state.error.empty_sequence.map(function (errorObject, index) {
                    // Get the entire isolate object identified by the isolate_id.
                    var isolate = _.find(this.props.detail.isolates, {isolate_id: errorObject.isolate_id});

                    return (
                        <li key={index}>
                            <span>sequence accession </span>
                            <span>'{errorObject.sequence_id}' in isolate '{Utils.formatIsolateName(isolate)}'</span>
                        </li>
                    );
                }, this);

                errors.push(
                    <li key='emptySequence'>
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
                    <Flex.Item grow={1}>
                        This virus was modified since the last index rebuild. Verify that it is ready to be included in
                        the next rebuild.
                    </Flex.Item>
                    <Flex.Item grow={0} pad={15}>
                        {verifyButton}
                    </Flex.Item>
                </Flex>
            );
        }

        return (
            <Collapse in={this.props.show} timeout={150}>
                <Alert bsStyle={this.state.error ? 'danger': 'warning'} className="clearfix">
                    {content}
                </Alert>
            </Collapse>
        );
    }

});

module.exports = ConfirmVirus;