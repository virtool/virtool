import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, Icon, SuccessLabel } from "../../../base";
import { checkRefRight, followDownload } from "../../../utils/utils";
import { setIsolateAsDefault, showEditIsolate, showRemoveIsolate } from "../../actions";
import EditIsolate from "./EditIsolate";
import RemoveIsolate from "./RemoveIsolate";
import IsolateSequences from "./Sequences";

export class IsolateDetail extends React.Component {
    handleDownload = () => {
        followDownload(`/download/otus/${this.props.otuId}/isolates/${this.props.activeIsolate.id}`);
    };

    handleSetDefaultIsolate = () => {
        this.props.setIsolateAsDefault(this.props.otuId, this.props.activeIsolate.id);
    };

    render() {
        const isolate = this.props.activeIsolate;

        const defaultIsolateLabel = (
            <Label bsStyle="success" style={{ visibility: isolate.default ? "visible" : "hidden" }}>
                <Icon name="star" /> Default Isolate
            </Label>
        );

        let modifyIcons;

        if (this.props.canModify) {
            modifyIcons = (
                <span>
                    <Icon
                        name="pencil-alt"
                        bsStyle="warning"
                        tip="Edit Isolate"
                        tipPlacement="left"
                        onClick={this.props.showEditIsolate}
                        style={{ paddingLeft: "7px" }}
                    />
                    {isolate.default ? null : (
                        <Icon
                            name="star"
                            bsStyle="success"
                            tip="Set as Default"
                            tipPlacement="left"
                            onClick={this.handleSetDefaultIsolate}
                            style={{ paddingLeft: "3px" }}
                        />
                    )}
                    <Icon
                        name="trash"
                        bsStyle="danger"
                        tip="Remove Isolate"
                        tipPlacement="left"
                        onClick={this.props.showRemoveIsolate}
                        style={{ paddingLeft: "3px" }}
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

                <RemoveIsolate />

                <Panel>
                    <Panel.Body>
                        <h5
                            style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: "15px"
                            }}
                        >
                            <strong style={{ flex: "1 0 auto" }}>{isolate.name}</strong>

                            {defaultIsolateLabel}
                            {modifyIcons}

                            <Icon
                                name="download"
                                tip="Download FASTA"
                                tipPlacement="left"
                                style={{ paddingLeft: "3px" }}
                                onClick={this.handleDownload}
                            />
                        </h5>

                        <IsolateTable
                            isDefault={isolate.default}
                            sourceName={isolate.source_name}
                            sourceType={isolate.source_type}
                        />

                        <IsolateSequences canModify={this.props.canModify} />
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
    canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu")
});

const mapDispatchToProps = dispatch => ({
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(IsolateDetail);
