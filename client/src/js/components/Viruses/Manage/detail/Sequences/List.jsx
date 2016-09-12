/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusSequences
 */

'use strict';

var React = require('react');
var FlipMove = require('react-flip-move');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');
var Badge = require('react-bootstrap/lib/Badge');

var Sequence = require('./Sequence.jsx');
var AddSequence = require('./Add.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component based on ListGroup that displays sequences associated with a passed
 *
 * @class
 */
var VirusSequences = React.createClass({

    propTypes: {
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string,
        data: React.PropTypes.arrayOf(React.PropTypes.object),
        canModify: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            data: []
        };
    },

    getInitialState: function () {
        return {
            activeSequenceId: this.getFirstSequenceId(this.props.data),
            editing: false
        };
    },

    componentWillReceiveProps: function (nextProps) {
        // If the active isolate is about to change, unset editing mode and set the active sequence to the first one
        // in the new isolates sequence list.
        if (nextProps.isolateId !== this.props.isolateId) {
            this.setState({
                activeSequenceId: this.getFirstSequenceId(nextProps.data),
                editing: false
            });
        }
    },

    /**
     * Get the first sequenceId in the passed array of sequence documents.
     *
     * @param sequences {array} - an array of sequence documents.
     * @returns {any} - the first sequenceId or null if sequences is empty.
     * @func
     */
    getFirstSequenceId: function (sequences) {
        return sequences && sequences.length > 0 ? sequences[0]._id: null;
    },

    /**
     * Set a new active sequence by sequenceId if the passed sequenceId is different from the current activeSequenceId.
     * Triggered by clicking on a different child Sequence component.
     *
     * @param sequenceId {string} - the sequenceId to set as the new active sequence.
     * @func
     */
    setActiveSequenceId: function (sequenceId) {
        if (sequenceId !== this.state.activeSequenceId) {
            this.setState({activeSequenceId: sequenceId === this.state.activeSequenceId ? null : sequenceId});
        }
    },

    /**
     * Toggles adding a new sequence. When toggled, a primary-styled SequenceForm that allows addition of a new sequence
     * appears in addition to the other sequence components
     *
     * @func
     */
    toggleAdding: function () {
        this.setState({
            activeSequenceId: this.state.activeSequenceId === 'new' ? this.getFirstSequenceId(this.props.data): 'new'
        });
    },

    render: function () {
        var lastComponent;

        var sequenceComponents = this.props.data.map(function (sequence) {
            return (
                <Sequence
                    {...sequence}
                    key={sequence._id}
                    sequenceId={sequence._id}
                    isolateId={this.props.isolateId}
                    virusId={this.props.virusId}
                    active={this.state.activeSequenceId === sequence._id}
                    onSelect={this.setActiveSequenceId}
                    canModify={this.props.canModify}
                />
            );
        }, this);

        var noSequencesFound = (
            <ListGroupItem>
                <div className='text-center'>
                    <Icon name='info'/> No sequences found.
                </div>
            </ListGroupItem>
        );

        if (this.props.canModify) {
            // A add-sequence button or a form for adding a sequence can be shown as the last item in the sequence list when
            // there is at least one isolate associated with the virus and the active isolate is not in the process of being
            // added (id === 'new').
            if (this.props.isolateId && this.props.isolateId !== 'new') {
                // If the active isolate is ready and no sequence is being added, show the add-sequence button.
                lastComponent = (
                    <AddSequence
                        virusId={this.props.virusId}
                        isolateId={this.props.isolateId}
                        toggleAdding={this.toggleAdding}
                        active={this.state.activeSequenceId === "new"}
                    />
                );
            } else {
                // Show warning when no sequences can be shown because there are no isolates associated with the virurs or
                // the active isolate is being added (id === 'new').
                lastComponent = noSequencesFound;
            }
        }

        if (!this.props.canModify && sequenceComponents.length === 0) {
            lastComponent = noSequencesFound
        }

        return (
            <div>
                <h5>
                    <strong><Icon name='dna' /> Isolate Sequences </strong>
                    <Badge>{this.props.data.length}</Badge>
                </h5>
                <FlipMove typeName="div" className="list-group">
                    {sequenceComponents}
                    {lastComponent}
                </FlipMove>
            </div>
        );
    }
});

module.exports = VirusSequences;