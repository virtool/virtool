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

const IsolateTable = ({ id, isDefault, sourceName, sourceType }) => (
    <Table bordered>
        <tbody>
            <tr>
                <th className="col-md-3">Source Type</th>
                <td className="col-md-9">{capitalize(sourceType)}</td>
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
        followDownload(`/download/otus/${this.props.otuId}/isolates/${this.props.activeIsolate.id}`);
    };

    handleSetDefaultIsolate = () => {
        this.props.setIsolateAsDefault(this.props.otuId, this.props.activeIsolate.id);
    };

    render () {
        const isolate = this.props.activeIsolate;

        const defaultIsolateLabel = (
            <Label bsStyle="info" style={{visibility: isolate.default ? "visible" : "hidden"}}>
                <Icon name="star" /> Default Isolate
            </Label>
        );

        let modifyIcons;

        if (this.props.hasModifyOTU && !this.props.isRemote) {
            modifyIcons = (
                <span>
                    <Icon
                        name="pencil-alt"
                        bsStyle="warning"
                        tip="Edit Isolate"
                        tipPlacement="left"
                        onClick={this.props.showEditIsolate}
                        style={{paddingLeft: "7px"}}
                    />
                    {isolate.default ? null : (
                        <Icon
                            name="star"
                            bsStyle="success"
                            tip="Set as Default"
                            tipPlacement="left"
                            onClick={this.handleSetDefaultIsolate}
                            style={{paddingLeft: "3px"}}
                        />
                    )}
                    <Icon
                        name="trash"
                        bsStyle="danger"
                        tip="Remove Isolate"
                        tipPlacement="left"
                        onClick={this.props.showRemoveIsolate}
                        style={{paddingLeft: "3px"}}
                    />
                </span>
            );
        }

        return (
            <div>
                <EditIsolate
                    key={isolate.id}
                    otuId={this.props.otuId}
                    isolateId={isolate.id}
                    sourceType={isolate.source_type}
                    sourceName={isolate.source_name}
                />

                <RemoveIsolate
                    otuId={this.props.otuId}
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
                                tipPlacement="left"
                                style={{paddingLeft: "3px"}}
                                onClick={this.handleDownload}
                            />
                        </h5>

                        <IsolateTable
                            id={isolate.id}
                            isDefault={isolate.default}
                            sourceName={isolate.source_name}
                            sourceType={isolate.source_type}
                        />

                        <IsolateSequences hasModifyOTU={this.props.hasModifyOTU} />
                    </Panel.Body>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    isolates: state.otus.detail.isolates,
    otuId: state.otus.detail.id,
    activeIsolate: state.otus.activeIsolate,
    activeIsolateId: state.otus.activeIsolateId,
    activeSequenceId: state.otus.activeSequenceId,
    editing: state.otus.editingIsolate,
    allowedSourceTypes: state.settings.data.allowed_source_types,
    restrictSourceTypes: state.settings.data.restrict_source_types,
    isRemote: state.references.detail.remotes_from
});

const mapDispatchToProps = (dispatch) => ({

    setIsolateAsDefault: (otuId, isolateId) => {
        dispatch(setIsolateAsDefault(otuId, isolateId));
    },

    showEditIsolate: (otuId, isolateId, sourceType, sourceName) => {
        dispatch(showEditIsolate(otuId, isolateId, sourceType, sourceName));
    },

    showRemoveIsolate: () => {
        dispatch(showRemoveIsolate());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);
