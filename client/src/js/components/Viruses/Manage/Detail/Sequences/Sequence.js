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

import CX from "classnames";
import React from "react";
import { isEqual, assign, pick } from "lodash-es";
import { Collapse } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import SequenceHeader from "./Header";
import SequenceForm from "./Form";

const getInitialState = (props) => ({
    sequenceId: props.sequenceId,
    definition: props.definition,
    host: props.host,
    sequence: props.sequence,
    pendingRemove: false,
    editing: false
});

/**
 * A ListGroupItem-based component that describes a sequence document. Used for reading sequence details, editing
 * existing sequences, and adding new sequences.
 *
 * @class
 */
export default class Sequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }
    
    static propTypes = {
        // Data describing the sequence document.
        _id: React.PropTypes.string,
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
    };

    static defaultProps = {
        sequenceId: "",
        definition: "",
        host: "",
        sequence: ""
    };

    componentWillReceiveProps = (nextProps) => {

        let state = getInitialState();

        // If the sequence was editing, but loses active status, disable editing in state.
        if ((!nextProps.active && this.props.active) && this.state.editing) {
            state.editing = false;
        }

        if (!isEqual(this.props, nextProps)) {
            assign(state, nextProps, {});
            state.editing = false;
        }

        this.setState(state);
    };

    componentWillUnmount () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    }

    handleKeyUp = (event) => {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.toggleEditing();
        }
    };

    /**
     * Send a request to the server to upsert a sequence. Triggered by clicking the save icon button (blue floppy) or
     * by a submit event on the form.
     *
     * @param event {object} - the event that triggered this callback. Will be used to prevent the default action.
     * @func
     */
    save = (event) => {
        event.preventDefault();

        const newEntry = assign(pick(this.state, ["definition", "host", "sequence"]), {
            _id: this.props.sequenceId,
            isolate_id: this.props.isolateId
        });

        dispatcher.db.viruses.request("update_sequence", {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId,
            new: newEntry
        });
    };

    remove = () => {
        this.setState({pendingRemove: true}, () => {
            dispatcher.db.viruses.request("remove_sequence", {
                "_id": this.props.virusId,
                "sequence_id": this.props.sequenceId
            });
        });
    };

    update = (data) => {
        this.setState(data);
    };

    /**
     * Handles a click event on the sequence. Calls the onSelect prop with the sequenceId for this component.
     *
     * @func
     */
    handleClick = () => {
        this.props.onSelect(this.props._id);
    };

    /**
     * Toggle editing mode on the sequence component. Triggered by clicking the yellow pencil icon for by cancelling an
     * edit.
     *
     * @func
     */
    toggleEditing = () => {
        if (this.state.editing) {
            this.setState(getInitialState(this.props), () => {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        } else {
            this.setState({editing: true}, () => {
                document.addEventListener("keyup", this.handleKeyUp, true);
            });
        }
    };

    render () {

        let icons = [];

        if (this.props.canModify && this.props.active && !this.state.editing) {
            icons = [
                <Icon
                    key="edit"
                    name="pencil"
                    bsStyle="warning"
                    onClick={this.toggleEditing}
                />,

                <Icon
                    key="remove"
                    name="remove"
                    bsStyle="danger"
                    pending={this.state.pendingRemove}
                    onClick={this.remove}
                />
            ];
        }

        if (this.state.editing) {
            icons = [
                <Icon
                    key="save"
                    name="floppy"
                    bsStyle="primary"
                    onClick={this.save}
                />,

                <Icon
                    key="cancel"
                    name="cancel-circle"
                    bsStyle="danger"
                    onClick={this.toggleEditing}
                />
            ];
        }

        const itemClass = CX({
            "list-group-item": true,
            "hoverable": !this.props.active
        });

        const itemStyle = this.state.editing ? {background: "#fcf8e3"}: null;

        // Props picked from this component"s props and passed to the content component regardless of its type.
        const contentProps = pick(this.props, [
            "sequenceId",
            "virusId",
            "isolateId",
            "canModify"
        ]);

        // Further extend contentProps for the Sequence component.
        assign(contentProps, pick(this.state, ["definition", "host", "sequence"]), {
            onSubmit: this.save,
            update: this.update,
            mode: this.state.editing ? "edit": "read"
        });

        const formStyle = this.props.active ? null: {marginTop: "1px"};

        // If not active, the ListGroupItem contains only the accession, sequence definition, and icon buttons.
        return (
            <div className={itemClass} style={itemStyle} onClick={this.props.active ? null: this.handleClick}>
                <SequenceHeader {...contentProps}>
                    {icons}
                </SequenceHeader>
                <Collapse in={this.props.active}>
                    <div>
                        <div style={{height: "15px"}} />
                        <div style={formStyle}>
                            <SequenceForm {...contentProps} />
                        </div>
                    </div>
                </Collapse>
            </div>
        );
    }
}
