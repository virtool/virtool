import React from "react";
import { capitalize } from "lodash-es";
import { connect } from "react-redux";
import { Label, Panel, Table } from "react-bootstrap";

import EditIsolate from "./EditIsolate";
import IsolateSequences from "./Sequences";
import RemoveIsolate from "./RemoveIsolate";
import { Icon, IDRow } from "../../../base";
import { followDownload } from "../../../utils";
import { setIsolateAsDefault, showEditIsolate, showRemoveIsolate } from "../../actions";

const IsolateTable = ({ id, isDefault, isolateName, sourceName, sourceType }) => (
    <Table bordered>
        <tbody>
            <tr>
                <th className="col-md-3">Name</th>
                <td className="col-md-9">{isolateName}</td>
            </tr>
            <tr>
                <th>Source Type</th>
                <td>{capitalize(sourceType)}</td>
            </tr>
            <tr>
                <th>Source Name</th>
                <td>{sourceName}</td>
            </tr>
            <tr>
                <th>Default</th>
                <td>
                    <Label bsStyle={isDefault ? "success" : "default"}>
                        {isDefault ? "Yes" : "No"}
                    </Label>
                </td>
            </tr>
            <IDRow id={id} />
        </tbody>
    </Table>
);

export class IsolateDetail extends React.Component {

    handleDownload = () => {
        followDownload(`/download/OTUs/${this.props.OTUId}/isolates/${this.props.activeIsolate.id}`);
    };

    handleSetDefaultIsolate = () => {
        this.props.setIsolateAsDefault(this.props.OTUId, this.props.activeIsolate.id);
    };

    render () {
        const isolate = this.props.activeIsolate;

        const defaultIsolateLabel = (
            <Label bsStyle="info" style={{visibility: this.props.default ? "visible" : "hidden"}}>
                <Icon name="star" /> Default Isolate
            </Label>
        );

        let modifyIcons;

        if (this.props.canModify) {
            modifyIcons = (
                <span>
                    <Icon
                        name="pencil"
                        bsStyle="warning"
                        tip="Edit Name"
                        onClick={this.props.showEditIsolate}
                        style={{paddingLeft: "7px"}}
                    />

                    {isolate.default ? null : (
                        <Icon
                            name="star"
                            bsStyle="success"
                            tip="Set as Default"
                            onClick={this.handleSetDefaultIsolate}
                            style={{paddingLeft: "3px"}}
                        />
                    )}

                    <Icon
                        name="remove"
                        bsStyle="danger"
                        tip="Remove Isolate"
                        onClick={this.props.showRemoveIsolate}
                        style={{paddingLeft: "3px"}}
                    />
                </span>
            );
        }

        return (
            <div>
                <EditIsolate
                    OTUId={this.props.OTUId}
                    isolateId={isolate.id}
                    sourceType={isolate.source_type}
                    sourceName={isolate.source_name}
                />

                <RemoveIsolate
                    OTUId={this.props.OTUId}
                    isolateId={isolate.id}
                    isolateName={isolate.name}
                    nextIsolateId={this.props.isolates.length ? this.props.isolates[0].id : null}
                />

                <Panel>
                    <Panel.Body>
                        <h5 style={{display: "flex", alignItems: "center", marginBottom: "15px"}}>
                            <strong style={{flex: "1 0 auto"}}>{isolate.name}</strong>

                            {defaultIsolateLabel}
                            {modifyIcons}

                            <Icon
                                name="download"
                                tip="Download FASTA"
                                style={{paddingLeft: "3px"}}
                                onClick={this.handleDownload}
                            />
                        </h5>

                        <IsolateTable
                            id={isolate.id}
                            isDefault={isolate.default}
                            isolateName={isolate.name}
                            sourceName={isolate.sourceName}
                            sourceType={isolate.sourceType}
                        />

                        <IsolateSequences />
                    </Panel.Body>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    isolates: state.OTUs.detail.isolates,
    OTUId: state.OTUs.detail.id,
    activeIsolate: state.OTUs.activeIsolate,
    activeIsolateId: state.OTUs.activeIsolateId,
    activeSequenceId: state.OTUs.activeSequenceId,
    editing: state.OTUs.editingIsolate,
    allowedSourceTypes: state.settings.data.allowed_source_types,
    restrictSourceTypes: state.settings.data.restrict_source_types,
    canModify: state.account.permissions.modify_OTU
});

const mapDispatchToProps = (dispatch) => ({

    setIsolateAsDefault: (OTUId, isolateId) => {
        dispatch(setIsolateAsDefault(OTUId, isolateId));
    },

    showEditIsolate: (OTUId, isolateId, sourceType, sourceName) => {
        dispatch(showEditIsolate(OTUId, isolateId, sourceType, sourceName));
    },

    showRemoveIsolate: () => {
        dispatch(showRemoveIsolate());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);
