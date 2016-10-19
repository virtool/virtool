/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveSequenceMethod
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Modal = require('react-bootstrap/lib/Modal');

var SequenceForm = require('virtool/js/components/Viruses/Manage/Detail/Sequences/Form.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');

/**
 * A text element and modal component that show the details of a sequence removed by the remove_sequence method.
 *
 * @class
 */
var RemoveSequenceMethod = React.createClass({

    getInitialState: function () {
        return {show: false};
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state.show !== nextState.show;
    },

    /**
     * Shows the change detail modal. Triggered by clicking the question mark icon.
     *
     * @func
     */
    showModal: function () {
        this.setState({show: true});
    },

    /**
     * Hides the change detail modal. Triggered as the onHide prop function for the modal.
     *
     * @func
     */
    hideModal: function () {
        this.setState({show: false});
    },

    render: function () {
        // Extract the sequence from the history document.
        var sequence = _.find(this.props.changes, function (change) {
            return change[0] == 'remove';
        })[2][0][1];

        // Calculate an isolate name.
        var isolateName = Utils.formatIsolateName(this.props.annotation);

        // A message shown in the HistoryItem and the detail modal that describes the change.
        var removedMessage = (
            <span>
                <Icon name='dna' bsStyle='danger' /> Removed sequence {sequence._id} from <em>{isolateName}</em>
            </span>
        );

        return (
            <span>
                <span>{removedMessage} ({this.props.annotation.isolate_id}) </span>
                <Icon name='question' bsStyle='info' onClick={this.showModal} />

                <Modal show={this.state.show} onHide={this.hideModal} animation={false}>
                    <Modal.Header>
                        <Modal.Title>
                            {removedMessage}
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

module.exports = RemoveSequenceMethod;