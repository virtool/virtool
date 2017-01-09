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

import React from "react";
import CX from "classnames";
import { assign, isEqual, pick, omit } from "lodash";
import { Collapse } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button, LoadingOverlay } from "virtool/js/components/Base";

import SequenceForm from "./Form";

const getInitialState = () => ({
    sequenceId: "",
    definition: "",
    host: "",
    sequence: "",
    collapsed: true,
    pendingAutofill: false,
    error: null
});


export default class AddSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        active: React.PropTypes.bool,
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string.isRequired,
        toggleAdding: React.PropTypes.func.isRequired
    };

    static defaultProps = {
        active: false
    };

    componentWillReceiveProps = (nextProps) => {
        // If the sequence was editing, but loses active status, disable editing in state.
        if (this.props.active && !nextProps.active) {
            this.setState(getInitialState(), () => {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        }

        if (!isEqual(this.props, nextProps)) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }
    };

    componentWillUnmount () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    }

    handleKeyUp = (event) => {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.setState(getInitialState(), this.props.toggleAdding);
        }
    };

    collapseEntered = () => {
        this.setState({
            collapsed: false
        });
    };

    collapseExited = () => {
        this.setState({
            collapsed: true
        });
    };

    /**
     * Sends a request to the server to get NCBI data for the current accession (sequenceId) entered in the accession
     * field. Handlers deal with the data from NCBI received in a successful transaction or the failure of the request.
     *
     * @func
     */
    autofill = () => {
        this.setState({pendingAutofill: true}, () => {
            dispatcher.db.viruses.request("fetch_ncbi", {accession: this.state.sequenceId})
                .success((data) => {
                    // Remove the accession from the data as this is already entered in the form and we don"t want it to
                    // change.
                    let state = omit(data, "accession");

                    // Get rid of the pendingAutofill state that causes a "Fetching" message to be overlaid on the
                    // sequence item.
                    state.pendingAutofill = false;

                    this.setState(state);
                })
                .failure(() => {
                    this.setState({
                        pendingAutofill: false,
                        error: "Could not find data for accession."
                    });
                });
        });
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
            _id: this.state.sequenceId,
            isolate_id: this.props.isolateId
        });

        dispatcher.db.viruses.request("add_sequence", {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId,
            new: newEntry
        }).success(this.props.toggleAdding).failure(this.onSaveFailure);
    };

    update = (data) => {
        this.setState(assign({}, data, {error: null}));
    };

    handleClick = () => {
        this.props.toggleAdding();
    };

    render () {

        const itemStyle = this.props.active || !this.state.collapsed ? {background:  "#dbe9f5"}: null;

        // Props picked from this component"s props and passed to the content component regardless of its type.
        const contentProps = pick(this.state, [
            "sequenceId",
            "definition",
            "host",
            "sequence",
            "pendingAutofill",
            "error"
        ]);

        // Further extend contentProps for the Sequence component.
        assign(contentProps, pick(this.props, ["virusId", "isolateId", "canModify"]), {
            onSubmit: this.save,
            autofill: this.autofill,
            update: this.update,
            mode: "add"
        });

        const classes = CX("list-group-item", {"hoverable": !this.props.active});

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
                            <FlexItem>
                                <Button onClick={this.props.toggleAdding}>
                                    Cancel
                                </Button>
                            </FlexItem>
                            <FlexItem pad>
                                <Button bsStyle="primary" onClick={this.save}>
                                    <Icon name="floppy" /> Save
                                </Button>
                            </FlexItem>
                        </Flex>
                    </div>
                </Collapse>
            </div>
        );

    }
}
