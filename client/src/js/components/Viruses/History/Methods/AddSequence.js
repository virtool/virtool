/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddSequenceMethod
 */

'use strict';

import React from "react";
import { find } from "lodash";
import { Modal } from "react-bootstrap";
import { formatIsolateName } from "virtool/js/utils";
import { Icon } from 'virtool/js/components/Base';

var SequenceForm = require('virtool/js/components/Viruses/Manage/Detail/Sequences/Form');

/**
 * A description of the change made by the add_sequence method. Can display a modal showing the added sequence.
 *
 * @class
 */
var AddSequenceMethod = React.createClass({

    getInitialState: function () {
        // State determines whether a modal detailing the change should be shown.
        return {show: false};
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state.show !== nextState.show;
    },

    /**
     * Shows the detail modal. Triggered by clicking the question icon.
     *
     * @func
     */
    showModal: function () {
        this.setState({show: true});
    },

    /**
     * Hides the detail modal. Triggered as the modal onHide prop.
     *
     * @func
     */
    hideModal: function () {
        this.setState({show: false});
    },

    render: function () {
        // Extract the added sequence from the history document.
        var sequence = find(this.props.changes, function (change) {
            return change[0] == 'add';
        })[2][0][1];

        // Calculate an isolate from the source type and name.
        var isolateName = formatIsolateName(this.props.annotation);

        // A message that is shown both in the element describing the change in the HistoryItem and as the title for the
        // change detail modal.
        var addedMessage = (
            <span>
                <Icon name='dna' bsStyle='primary' /> Added sequence {sequence._id} to <em>{isolateName}</em>
            </span>
        );

        return (
            <span>
                {addedMessage} <em>({this.props.annotation.isolate_id}) </em>
                <Icon name='question' bsStyle='info' onClick={this.showModal} />

                <Modal show={this.state.show} onHide={this.hideModal} animation={false}>
                    <Modal.Header>
                        <Modal.Title>
                            {addedMessage}
                        </Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <SequenceForm
                            sequenceId={sequence._id}
                            definition={sequence.definition}
                            host={sequence.host}
                            sequence={sequence.sequence}
                            readOnly={true}
                        />
                    </Modal.Body>
                </Modal>
            </span>
        );
    }

});

module.exports = AddSequenceMethod;