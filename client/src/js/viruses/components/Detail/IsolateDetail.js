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
import URI from "urijs";
import { capitalize, find } from "lodash";
import { connect } from "react-redux";
import { Label, Panel, Table, ListGroup } from "react-bootstrap";

import { showEditIsolate, showRemoveIsolate } from "../../actions";
import { formatIsolateName } from "virtool/js/utils";
import { Icon, ListGroupItem } from "virtool/js/components/Base";
import Sequence from "./Sequence";
import EditIsolate from "./EditIsolate";
import RemoveIsolate from "./RemoveIsolate";

const IsolateDetail = (props) => {

    const activeIsolateId = props.match.params.isolateId;
    const isolate = find(props.isolates, {isolate_id: activeIsolateId});
    const isolateName = formatIsolateName(isolate);

    const activeAccession = props.match.params.accession;

    const defaultIsolateLabel = (
        <Label bsStyle="info" style={{visibility: props.default ? "visible": "hidden"}}>
            <Icon name="star" /> Default Isolate
        </Label>
    );

    let sequenceComponents = isolate.sequences.map(sequence =>
        <Sequence key={sequence.accession} active={sequence.accession === activeAccession} {...sequence} />
    );

    if (!sequenceComponents.length) {
        sequenceComponents = (
            <ListGroupItem className="text-center">
                <Icon name="info" /> No sequences added
            </ListGroupItem>
        );
    }

    let modifyIcons = (
        <span>
            <Icon
                name="pencil"
                bsStyle="warning"
                tip="Edit Name"
                onClick={props.showEditIsolate}
                style={{paddingLeft: "7px"}}
            />

            <Icon
                name="remove"
                bsStyle="danger"
                tip="Remove Isolate"
                onClick={props.showRemoveIsolate}
                style={{paddingLeft: "3px"}}
            />
        </span>
    );

    const nextURI = URI(props.location.pathname + props.location.search);

    if (props.isolates.length) {
        nextURI.segment(3, props.isolates[0].isolate_id);
    } else {
        nextURI.segment(3, "");
    }

    return (
        <div>
            <EditIsolate
                virusId={props.virusId}
                isolateId={isolate.isolate_id}
                sourceType={isolate.source_type}
                sourceName={isolate.source_name}
            />

            <RemoveIsolate
                virusId={props.virusId}
                isolateId={isolate.isolate_id}
                isolateName={formatIsolateName(isolate)}
                onSuccess={() => props.history.push(nextURI.toString())}
            />

            <Panel>
                <ListGroup fill>
                    <ListGroupItem>
                        <h5 style={{display: "flex", alignItems: "center", marginBottom: "15px"}}>
                            <strong style={{flex: "1 0 auto"}}>{isolateName}</strong>
                            {defaultIsolateLabel}
                            {modifyIcons}
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
                                    <th>Unique ID</th>
                                    <td className="text-uppercase">{isolate.isolate_id}</td>
                                </tr>
                            </tbody>
                        </Table>

                        <div style={{marginTop: "45px", display: "flex", alignItems: "center"}}>
                            <strong style={{flex: "1 0 auto"}}>Sequences</strong>
                            <Icon
                                name="new-entry"
                                bsStyle="primary"
                                tip="Add Sequence"
                                pullRight
                            />
                        </div>
                    </ListGroupItem>

                    {sequenceComponents}
                </ListGroup>
            </Panel>
        </div>
    );
};

IsolateDetail.propTypes = {
    match: PropTypes.object,
    virusId: PropTypes.string,
    isolates: PropTypes.arrayOf(PropTypes.object),

    allowedSourceTypes: PropTypes.arrayOf(PropTypes.string),
    restrictSourceTypes: PropTypes.bool,
    showEditIsolate: PropTypes.func,
    showRemoveIsolate: PropTypes.func,

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
        showEditIsolate: (virusId, isolateId, sourceType, sourceName) => {
            dispatch(showEditIsolate(virusId, isolateId, sourceType, sourceName));
        },

        showRemoveIsolate: () => {
            dispatch(showRemoveIsolate());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);

export default Container;
