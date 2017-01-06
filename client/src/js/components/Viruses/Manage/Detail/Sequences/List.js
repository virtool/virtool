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

import React from "react";
import FlipMove from "react-flip-move"
import { Badge } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

import Sequence from "./Sequence";
import AddSequence from "./Add";

const getFirstSequenceId = (sequences) => sequences && sequences.length > 0 ? sequences[0]._id: null;

export default class VirusSequences extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            activeSequenceId: getFirstSequenceId(this.props.data),
            editing: false
        };
    }

    static propTypes = {
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string,
        data: React.PropTypes.arrayOf(React.PropTypes.object),
        canModify: React.PropTypes.bool
    };

    static defaultProps = {
        data: []
    };

    componentWillReceiveProps = (nextProps) => {
        // If the active isolate is about to change, unset editing mode and set the active sequence to the first one
        // in the new isolates sequence list.
        if (nextProps.isolateId !== this.props.isolateId) {
            this.setState({
                activeSequenceId: getFirstSequenceId(nextProps.data),
                editing: false
            });
        }
    };

    /**
     * Get the first sequenceId in the passed array of sequence documents.
     *
     * @param sequences {array} - an array of sequence documents.
     * @returns {any} - the first sequenceId or null if sequences is empty.
     * @func
     */


    /**
     * Set a new active sequence by sequenceId if the passed sequenceId is different from the current activeSequenceId.
     * Triggered by clicking on a different child Sequence component.
     *
     * @param sequenceId {string} - the sequenceId to set as the new active sequence.
     * @func
     */
    setActiveSequenceId = (sequenceId) => {
        if (sequenceId !== this.state.activeSequenceId) {
            this.setState({activeSequenceId: sequenceId === this.state.activeSequenceId ? null : sequenceId});
        }
    };

    /**
     * Toggles adding a new sequence. When toggled, a primary-styled SequenceForm that allows addition of a new sequence
     * appears in addition to the other sequence components
     *
     * @func
     */
    toggleAdding = () => {
        this.setState({
            activeSequenceId: this.state.activeSequenceId === "new" ? getFirstSequenceId(this.props.data): "new"
        });
    };

    render () {

        const sequenceComponents = this.props.data.map((sequence) =>
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

        let lastComponent;

        if (this.props.canModify && sequenceComponents.length > 0 &&
            this.props.isolateId && this.props.isolateId !== "new") {
            lastComponent = (
                <AddSequence
                    virusId={this.props.virusId}
                    isolateId={this.props.isolateId}
                    toggleAdding={this.toggleAdding}
                    active={this.state.activeSequenceId === "new"}
                />
            );
        } else {
            lastComponent = (
                <ListGroupItem>
                    <div className="text-center">
                        <Icon name="info"/> No sequences found.
                    </div>
                </ListGroupItem>
            );
        }

        return (
            <div style={{overflowY: "hidden"}}>
                <h5>
                    <strong><Icon name="dna" /> Isolate Sequences </strong>
                    <Badge>{this.props.data.length}</Badge>
                </h5>
                <FlipMove typeName="div" className="list-group" enterAnimation="fade" leaveAnimation={false}>
                    {sequenceComponents}
                    {lastComponent}
                </FlipMove>
            </div>
        );
    }
}
