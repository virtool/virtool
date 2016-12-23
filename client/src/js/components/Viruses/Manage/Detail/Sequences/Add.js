/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Sequence
 */

'use strict';

import React from "react";
import CX from 'classnames';
import { isEqual, pick, omit, merge } from 'lodash';
import { Collapse, ButtonToolbar } from 'react-bootstrap';
import { Flex, Icon, Button, LoadingOverlay } from 'virtool/js/components/Base';

var SequenceForm = require('./Form');

var AddSequence = React.createClass({

    propTypes: {
        active: React.PropTypes.bool,
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string.isRequired
    },

    getDefaultProps: function () {
        return {
            active: false
        };
    },

    getInitialState: function () {
        return {
            sequenceId: '',
            definition: '',
            host: '',
            sequence: '',

            collapsed: true,

            pendingAutofill: false,
            error: null
        };
    },

    componentWillReceiveProps: function (nextProps) {
        // If the sequence was editing, but loses active status, disable editing in state.
        if (this.props.active && !nextProps.active) {
            this.setState(this.getInitialState(), function () {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        }

        if (!isEqual(this.props, nextProps)) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }
    },

    componentWillUnmount: function () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    },

    handleKeyUp: function (event) {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.setState(this.getInitialState(), this.props.toggleAdding);
        }
    },

    collapseEntered: function () {
        this.setState({
            collapsed: false
        });
    },

    collapseExited: function () {
        this.setState({
            collapsed: true
        });
    },

    /**
     * Sends a request to the server to get NCBI data for the current accession (sequenceId) entered in the accession
     * field. Handlers deal with the data from NCBI received in a successful transaction or the failure of the request.
     *
     * @func
     */
    autofill: function () {
        this.setState({pendingAutofill: true}, function () {
            dispatcher.db.viruses.request('fetch_ncbi', {accession: this.state.sequenceId})
                .success(function (data) {
                    // Remove the accession from the data as this is already entered in the form and we don't want it to change.
                    var state = omit(data, "accession");

                    // Get rid of the pendingAutofill state that causes a 'Fetching' message to be overlaid on the
                    // sequence item.
                    state.pendingAutofill = false;

                    this.setState(state);
                }, this)
                .failure(function () {
                    this.setState({
                        pendingAutofill: false,
                        error: 'Could not find data for accession.'
                    });
                }, this);
        });
    },

    /**
     * Send a request to the server to upsert a sequence. Triggered by clicking the save icon button (blue floppy) or
     * by a submit event on the form.
     *
     * @param event {object} - the event that triggered this callback. Will be used to prevent the default action.
     * @func
     */
    save: function (event) {
        event.preventDefault();

        var newEntry = merge(pick(this.state, ['definition', 'host', 'sequence']), {
            _id: this.state.sequenceId,
            isolate_id: this.props.isolateId
        });

        dispatcher.db.viruses.request('add_sequence', {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId,
            new: newEntry
        }).success(this.props.toggleAdding).failure(this.onSaveFailure);
    },

    update: function (data) {
        data.error = null;
        this.setState(data);
    },

    /**
     * Handles a click event on the sequence. Calls the onSelect prop with the sequenceId for this component.
     *
     * @func
     */
    handleClick: function () {
        this.props.toggleAdding();
    },

    render: function () {

        var itemStyle = this.props.active || !this.state.collapsed ? {background:  "#dbe9f5"}: null;

        // Props picked from this component's props and passed to the content component regardless of its type.
        var contentProps = pick(this.state, [
            'sequenceId',
            'definition',
            'host',
            'sequence',
            'pendingAutofill',
            'error'
        ]);

        // Further extend contentProps for the Sequence component.
        merge(contentProps, pick(this.props, ['virusId', 'isolateId', 'canModify']), {
            onSubmit: this.save,
            autofill: this.autofill,
            update: this.update,
            mode: "add"
        });

        var classes = CX({
            "list-group-item": true,
            "hoverable": !this.props.active,
        });

        return (
            <div className={classes} style={itemStyle} onClick={this.state.collapsed ? this.props.toggleAdding: null}>
                <Collapse in={!this.props.active && this.state.collapsed}>
                    <div className="text-center">
                        <Icon bsStyle="primary" name="plus-square" /> Add Sequence
                    </div>
                </Collapse>

                <Collapse in={this.props.active} onEntered={this.collapseEntered} onExited={this.collapseExited}>
                    <div>
                        <LoadingOverlay show={this.state.pendingAutofill} text="Fetching" />

                        <SequenceForm {...contentProps} />

                        <Flex justifyContent="flex-end">
                            <Flex.Item>
                                <Button onClick={this.props.toggleAdding}>
                                    Cancel
                                </Button>
                            </Flex.Item>
                            <Flex.Item pad>
                                <Button bsStyle="primary" onClick={this.save}>
                                    <Icon name="floppy" /> Save
                                </Button>
                            </Flex.Item>
                        </Flex>
                    </div>
                </Collapse>
            </div>
        );

    }
});

module.exports = AddSequence;