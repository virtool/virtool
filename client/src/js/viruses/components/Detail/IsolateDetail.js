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
import { Label, Panel, Table, ListGroup } from "react-bootstrap";

import { showEditIsolate, removeIsolate } from "../../actions";
import { formatIsolateName } from "virtool/js/utils";
import { Flex, FlexItem, Button, Icon, ListGroupItem } from "virtool/js/components/Base";
import Sequence from "./Sequence";
import EditIsolate from "./EditIsolate";

class IsolateDetail extends React.Component {

    render () {

        const activeIsolateId = this.props.match.params.isolateId;
        const isolate = find(this.props.isolates, {isolate_id: activeIsolateId});
        const isolateName = formatIsolateName(isolate);

        const activeAccession = this.props.match.params.accession;

        const defaultIsolateLabel = (
            <Label bsStyle="info" style={{visibility: "vi"}}>
                <Icon name="star" /> Default Isolate
            </Label>
        );

        let sequenceComponents = isolate.sequences.map(sequence => {
            return (
                <Sequence key={sequence.accession} active={sequence.accession === activeAccession} {...sequence} />
            );
        });

        if (!sequenceComponents.length) {
            sequenceComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No sequences added
                </ListGroupItem>
            )
        }

        return (
            <div>
                <EditIsolate
                    virusId={this.props.virusId}
                    isolateId={isolate.isolate_id}
                    sourceType={isolate.source_type}
                    sourceName={isolate.source_name}
                />

                <Panel>
                    <ListGroup fill>
                        <ListGroupItem>
                            <h5 style={{display: "flex", alignItems: "center", marginBottom: "15px"}}>
                                <strong style={{flex: "1 0 auto"}}>{isolateName}</strong>
                                {defaultIsolateLabel}
                            </h5>

                            <Flex style={{marginBottom: "15px"}}>
                                <FlexItem>
                                    <Button
                                        bsStyle="warning"
                                        bsSize="small"
                                        icon="pencil"
                                        onClick={this.props.showEditIsolate}
                                    >
                                        Edit Name
                                    </Button>
                                </FlexItem>

                                <FlexItem grow={1} pad={5}>
                                    <Button
                                        bsStyle="primary"
                                        bsSize="small"
                                        icon="new-entry"
                                    >
                                        Add Sequence
                                    </Button>
                                </FlexItem>

                                <FlexItem>
                                    <Button
                                        bsStyle="danger"
                                        bsSize="small"
                                        icon="remove"
                                        onClick={() => this.props.remove(this.props.virusId, isolate.isolate_id)}
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
                                        <td className="text-uppercase">{isolate.isolate_id}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </ListGroupItem>

                        {sequenceComponents}
                    </ListGroup>
                </Panel>
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
        showEditIsolate: (virusId, isolateId, sourceType, sourceName) => {
            dispatch(showEditIsolate(virusId, isolateId, sourceType, sourceName));
        },

        remove: (virusId, isolateId) => {
            dispatch(removeIsolate(virusId, isolateId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);

export default Container;
