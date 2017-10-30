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

import React from "react";
import { capitalize, find } from "lodash";
import { connect } from "react-redux";
import { Badge, Label, Panel, Table, ListGroup } from "react-bootstrap";

import {
    setIsolateAsDefault,
    showEditIsolate,
    showRemoveIsolate,
    showAddSequence,
    showEditSequence,
    showRemoveSequence
} from "../../actions";
import { Icon, ListGroupItem } from "../../../base";
import { formatIsolateName, followDownload } from "../../../utils";
import Sequence from "./Sequence";
import EditIsolate from "./EditIsolate";
import RemoveIsolate from "./RemoveIsolate";
import AddSequence from "./AddSequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";

const IsolateDetail = (props) => {

    const isolate = find(props.isolates, {id: props.activeIsolateId});

    const isolateName = formatIsolateName(isolate);

    const defaultIsolateLabel = (
        <Label bsStyle="info" style={{visibility: props.default ? "visible": "hidden"}}>
            <Icon name="star" /> Default Isolate
        </Label>
    );

    let sequenceComponents = isolate.sequences.map(sequence =>
        <Sequence
            key={sequence.id}
            active={sequence.accession === props.activeSequenceId}
            canModify={props.canModify}
            showEditSequence={props.showEditSequence}
            showRemoveSequence={props.showRemoveSequence}
            {...sequence}
        />
    );

    if (!sequenceComponents.length) {
        sequenceComponents = (
            <ListGroupItem className="text-center">
                <Icon name="info" /> No sequences added
            </ListGroupItem>
        );
    }

    let modifyIcons;

    if (props.canModify) {
        modifyIcons = (
            <span>
                <Icon
                    name="pencil"
                    bsStyle="warning"
                    tip="Edit Name"
                    onClick={props.showEditIsolate}
                    style={{paddingLeft: "7px"}}
                />

                {isolate.default ? null: (
                    <Icon
                        name="star"
                        bsStyle="success"
                        tip="Set as Default"
                        onClick={() => props.setIsolateAsDefault(props.virusId, isolate.id)}
                        style={{paddingLeft: "3px"}}
                    />
                )}

                <Icon
                    name="remove"
                    bsStyle="danger"
                    tip="Remove Isolate"
                    onClick={props.showRemoveIsolate}
                    style={{paddingLeft: "3px"}}
                />
            </span>
        );
    }

    return (
        <div>
            <EditIsolate
                virusId={props.virusId}
                isolateId={isolate.id}
                sourceType={isolate.source_type}
                sourceName={isolate.source_name}
            />

            <RemoveIsolate
                virusId={props.virusId}
                isolateId={isolate.id}
                isolateName={isolateName}
                nextIsolateId={props.isolates.length ? props.isolates[0].id: null}
            />

            <AddSequence
                virusId={props.virusId}
                isolateId={isolate.id}
            />

            <EditSequence
                virusId={props.virusId}
                isolateId={isolate.id}
            />

            <RemoveSequence
                virusId={props.virusId}
                isolateId={isolate.id}
                isolateName={isolateName}
            />

            <Panel>
                <ListGroup fill>
                    <ListGroupItem>
                        <h5 style={{display: "flex", alignItems: "center", marginBottom: "15px"}}>
                            <strong style={{flex: "1 0 auto"}}>{isolateName}</strong>

                            {defaultIsolateLabel}
                            {modifyIcons}

                            <Icon
                                name="download"
                                tip="Download FASTA"
                                style={{paddingLeft: "3px"}}
                                onClick={() => followDownload(
                                    `/download/viruses/${props.virusId}/isolates/${isolate.id}`
                                )}
                            />
                        </h5>

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
                                    <th>Default</th>
                                    <td>
                                        <Label bsStyle={isolate.default ? "success": "default"}>
                                            {isolate.default ? "Yes": "No"}
                                        </Label>
                                    </td>
                                </tr>
                                {props.showIds ? (
                                    <tr>
                                        <th>Unique ID</th>
                                        <td>{isolate.id}</td>
                                    </tr>
                                ): null}
                            </tbody>
                        </Table>

                        <div style={{marginTop: "45px", display: "flex", alignItems: "center"}}>
                            <strong style={{flex: "0 1 auto"}}>Sequences</strong>
                            <span style={{flex: "1 0 auto", marginLeft: "5px"}}>
                                <Badge>{isolate.sequences.length}</Badge>
                            </span>
                            {props.canModify ? (
                                <Icon
                                    name="new-entry"
                                    bsStyle="primary"
                                    tip="Add Sequence"
                                    onClick={() => props.showAddSequence()}
                                    pullRight
                                />
                            ): null}
                        </div>
                    </ListGroupItem>

                    {sequenceComponents}
                </ListGroup>
            </Panel>
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        isolates: state.viruses.detail.isolates,
        virusId: state.viruses.detail.id,
        activeIsolateId: state.viruses.activeIsolateId,
        activeSequenceId: state.viruses.activeSequenceId,
        editing: state.viruses.editingIsolate,
        editingSequence: state.viruses.editSequence,
        allowedSourceTypes: state.settings.data.allowed_source_types,
        restrictSourceTypes: state.settings.data.restrict_source_types,
        showIds: state.account.settings.show_ids,
        canModify: state.account.permissions.modify_virus
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setIsolateAsDefault: (virusId, isolateId) => {
            dispatch(setIsolateAsDefault(virusId, isolateId));
        },

        showEditIsolate: (virusId, isolateId, sourceType, sourceName) => {
            dispatch(showEditIsolate(virusId, isolateId, sourceType, sourceName));
        },

        showRemoveIsolate: () => {
            dispatch(showRemoveIsolate());
        },

        showAddSequence: () => {
            dispatch(showAddSequence());
        },

        showEditSequence: (sequenceId) => {
            dispatch(showEditSequence(sequenceId));
        },

        showRemoveSequence: (sequenceId) => {
            dispatch(showRemoveSequence(sequenceId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);

export default Container;
