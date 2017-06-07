/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Isolate
 */

import React, { PropTypes } from "react";
import { capitalize, find } from "lodash";
import { connect } from "react-redux";
import { Route, Redirect } from "react-router-dom";
import { Label, Panel, Table, ListGroup, FormGroup, FormControl, ControlLabel } from "react-bootstrap";

import { toggleIsolateEditing } from "../../../actions";
import { formatIsolateName } from "virtool/js/utils";
import { Flex, FlexItem, Button, Icon, Input, ListGroupItem } from "virtool/js/components/Base";
import Sequence from "./Sequence";

const save = (event) => {

    event.preventDefault();

    const hadChange = (
        this.state.sourceType !== this.props.sourceType ||
        this.state.sourceName !== this.props.sourceName
    );

    // Only send an update to the server if there has been a change in the sourceType or sourceName.
    if (hadChange) {
        // Set pendingChange so the component is disabled and a spinner icon is displayed.
        this.setState({pendingChange: true}, () => {
            // Construct a replacement isolate object and send it to the server.
            dispatcher.db.viruses.request("upsert_isolate", {
                _id: this.props.virusId,
                new: {
                    isolate_id: this.props.isolateId,
                    source_type: this.state.sourceType,
                    source_name: this.state.sourceName
                }
            }).success(this.toggleEditing);
        });
    }

    // If the data did not change, just close the form and save sending it to the server.
    else {
        this.toggleEditing();
    }
};

class IsolateDetail extends React.Component {

    componentWillReceiveProps (nextProps) {
        if (this.props.editing && !nextProps.editing) {
            document.removeEventListener("keyup", this.handleKeyUp, true);
            return;
        }

        if (!this.props.editing && nextProps.editing) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }
    }

    componentWillUnmount () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    }

    handleKeyUp = (e) => {
        if (e.keyCode === 27) {
            e.stopImmediatePropagation();

            if (this.props.editing) {
                this.props.toggleEditing();
            }
        }
    };

    render () {

        const activeIsolateId = this.props.match.params.isolateId;
        const isolate = find(this.props.isolates, {isolate_id: activeIsolateId});
        const isolateName = formatIsolateName(isolate);

        const activeAccession = this.props.match.params.accession;

        let editForm;

        if (this.props.editing) {
            let sourceTypeInput;

            if (this.props.restrictSourceTypes) {

                const options = this.props.allowedSourceTypes.map(sourceType =>
                    <option key={sourceType} value={sourceType}>
                        {capitalize(sourceType)}
                    </option>
                );

                sourceTypeInput = (
                    <FormGroup>
                        <ControlLabel>
                            Source Type
                        </ControlLabel>
                        <FormControl componentClass="select" value={isolate.source_type}>
                            <option key="unknown" value="unknown">Unknown</option>
                            {options}
                        </FormControl>
                    </FormGroup>
                )
            } else {
                sourceTypeInput = <Input label="Source Type" value={isolate.source_type}/>;
            }

            editForm = (
                <form>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            {sourceTypeInput}
                        </FlexItem>
                        <FlexItem grow={1} pad={5}>
                            <Input label="Source Name" value={isolate.source_name}/>
                        </FlexItem>
                        <FlexItem grow={1} pad={5}>
                            <Input label="Isolate Name" value={isolateName} readOnly/>
                        </FlexItem>
                        <Button bsStyle="primary" icon="floppy" style={{marginLeft: "5px", marginBottom: "15px"}}>
                            Save
                        </Button>
                    </Flex>
                </form>
            );
        }

        let defaultIsolateLabel;

        if (isolate.default) {
            defaultIsolateLabel = (
                <Label bsStyle="info">
                    <Icon name="star" /> Default Isolate
                </Label>
            );
        }

        const sequenceComponents = isolate.sequences.map((sequence) => {
            return (
                <Sequence key={sequence.accession} active={sequence.accession === activeAccession} {...sequence} />
            );
        });

        return (
            <div>
                <Redirect
                    from="/viruses/:virusId/virus/:isolateId"
                    to={`${this.props.match.url}/${isolate.sequences[0].accession}`}
                />

                <Route path="/viruses/:virusId/virus/:isolateId/:accession" render={() => (
                    <Panel>
                        <ListGroup fill>
                            <ListGroupItem>
                                <h5 style={{display: "flex", alignItems: "center", marginBottom: "15px"}}>
                                    <strong style={{flex: "1 0 auto"}}>{isolateName}</strong>
                                    {defaultIsolateLabel}
                                </h5>

                                <Flex style={{marginBottom: "15px"}}>
                                    <FlexItem grow={1}>
                                        <Button
                                            bsStyle="warning"
                                            bsSize="small"
                                            icon="pencil"
                                            active={this.props.editing}
                                            onClick={this.props.toggleEditing}
                                            block
                                        >
                                            Edit Name
                                        </Button>
                                    </FlexItem>

                                    <FlexItem grow={1} pad={5}>
                                        <Button
                                            bsStyle="primary"
                                            bsSize="small"
                                            icon="new-entry"
                                            block
                                        >
                                            Add Sequence
                                        </Button>
                                    </FlexItem>

                                    <FlexItem grow={1} pad={5}>
                                        <Button
                                            bsStyle="danger"
                                            bsSize="small"
                                            icon="remove"
                                            block
                                        >
                                            Remove
                                        </Button>
                                    </FlexItem>
                                </Flex>

                                <Table bordered>
                                    <tbody>
                                        <tr>
                                            <th className="col-md-3">Name</th>
                                            <td className="col-md-9">{isolateName}</td>
                                        </tr>
                                        <tr>
                                            <th>Source Type</th>
                                            <td>{capitalize(isolate.source_type)}</td>
                                        </tr>
                                        <tr>
                                            <th>Source Name</th>
                                            <td>{isolate.source_name}</td>
                                        </tr>
                                        <tr>
                                            <th>Unique ID</th>
                                            <td>{isolate.isolate_id}</td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </ListGroupItem>

                            {sequenceComponents}
                        </ListGroup>
                    </Panel>
                )} />
            </div>
        );
    }
}

IsolateDetail.propTypes = {
    match: PropTypes.object,
    isolates: PropTypes.arrayOf(PropTypes.object),
    editing: PropTypes.bool,
    allowedSourceTypes: PropTypes.arrayOf(PropTypes.string),
    restrictSourceTypes: PropTypes.bool,
    toggleEditing: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        isolates: state.viruses.detail.isolates,
        virusId: state.viruses.detail.virus_id,
        editing: state.viruses.editingIsolate,
        allowedSourceTypes: state.settings.data.allowed_source_types,
        restrictSourceTypes: state.settings.data.restrict_source_types
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        toggleEditing: () => {
            dispatch(toggleIsolateEditing());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);

export default Container;
