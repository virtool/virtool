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

var _ = require('lodash');
var React = require('react');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var SequenceHeader = require('./Header.jsx');
var ReadOnly = require('./ReadOnly.jsx');
var Modify = require('./Modify.jsx');

/**
 * A ListGroupItem-based component that describes a sequence document. Used for reading sequence details, editing
 * existing sequences, and adding new sequences.
 *
 * @class
 */
var Sequence = React.createClass({

    propTypes: {
        // Data describing the sequence document.
        virusId: React.PropTypes.string,
        isolateId: React.PropTypes.string,
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string,
        host: React.PropTypes.string,
        sequence: React.PropTypes.string,

        // Whether the sequence is the active sequence.
        active: React.PropTypes.bool,
        canModify: React.PropTypes.bool,

        // Function to call when the component is clicked. Makes this component the new active sequence.
        onSelect: React.PropTypes.func
    },

    getInitialState: function () {
        return {editing: false};
    },

    componentWillReceiveProps: function (nextProps) {
        // If the sequence was editing, but loses active status, disable editing in state.
        if ((!nextProps.active && this.props.active) && this.state.editing) this.setState({editing: false});
    },

    /**
     * Handles a click event on the sequence. Calls the onSelect prop with the sequenceId for this component.
     *
     * @func
     */
    handleClick: function () {
        this.props.onSelect(this.props._id);
    },

    /**
     * Toggle editing mode on the sequence component. Triggered by clicked the yellow pencil icon for by cancelling an
     * edit.
     *
     * @func
     */
    toggleEditing: function () {
        this.setState({editing: !this.state.editing});
    },

    render: function () {
        // Props picked from this component's props and passed to the content component regardless of its type.
        var contentProps = _.pick(this.props, [
            'virusId',
            'isolateId',
            'definition',
            'host',
            'sequence',
            'canModify'
        ]);

        _.assign(contentProps, {
            onEdit: this.toggleEditing,
            editing: this.state.editing,
            sequenceId: this.props._id
        });

        if (this.props.active) {
            // Return a form component when the sequence event is active. Will be either editable or readOnly.
            return this.state.editing ? <Modify {...contentProps} />: <ReadOnly {...contentProps} />;
        } else {
            // If not active, the ListGroupItem contains only the accession, sequence definition, and icon buttons.
            return (
                <ListGroupItem onClick={this.handleClick}>
                    <SequenceHeader {...contentProps} />
                </ListGroupItem>
            );
        }
    }
});

module.exports = Sequence;