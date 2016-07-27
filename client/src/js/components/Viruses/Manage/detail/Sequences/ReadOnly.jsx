/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ReadOnly
 */

'use strict';

var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');
var SequenceHeader = require('./Header.jsx');
var SequenceForm = require('./Form.jsx');

/**
 * A composition of the SequenceForm component, where all the fields are readOnly. Used for presenting sequence data.
 * This is default content component for an active Sequence component. Has active band box-shadow formatting.
 *
 * @class
 */
var ReadOnly = React.createClass({

    propTypes: {
        // Data describing the sequence.
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string.isRequired,
        sequenceId: React.PropTypes.string.isRequired,
        definition: React.PropTypes.string,
        host: React.PropTypes.string,
        sequence: React.PropTypes.string,

        // Function to call when the edit icon (yellow pencil) is clicked.
        onEdit: React.PropTypes.func.isRequired,

        canModify: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            sequenceId: '',
            definition: '',
            host: '',
            sequence: ''
        };
    },

    /**
     * Called when the remove icon button (red trashcan) is clicked. Sends a request to the server to remove the
     * sequence represented by this component.
     *
     * @func
     */
    remove: function () {
        dispatcher.db.viruses.request('remove_sequence', {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId,
            sequence_id: this.props.sequenceId
        });
    },

    render: function () {

        var icons;

        if (this.props.canModify) {
            icons = (
                <span>
                    <Icon name='pencil' bsStyle='warning' onClick={this.props.onEdit} />
                    <Icon name='remove' bsStyle='danger' onClick={this.remove} />
                </span>
            );
        }

        return (
            <ListGroupItem className='band' allowFocus>
                <SequenceHeader sequenceId={this.props.sequenceId} definition={this.props.definition}>
                    {icons}
                </SequenceHeader>
                <SequenceForm
                    {...this.props}
                />
            </ListGroupItem>
        );
    }
});

module.exports = ReadOnly;
