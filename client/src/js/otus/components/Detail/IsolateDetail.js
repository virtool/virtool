import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, Icon, Label } from "../../../base";
import { checkRefRight, followDownload } from "../../../utils/utils";
import { setIsolateAsDefault, showEditIsolate, showRemoveIsolate } from "../../actions";
import EditIsolate from "./EditIsolate";
import RemoveIsolate from "./RemoveIsolate";
import IsolateSequences from "./Sequences";
import IsolateTargets from "./Targets";

const IsolateDetailBox = styled(BoxGroup)`
    margin: 0;
`;

const IsolateDetailHeader = styled(BoxGroupHeader)`
    align-items: center;
    display: flex;
    font-size: 16px;
    flex-direction: row;
    justify-content: space-between;

    div:first-child {
        font-weight: bold;
    }
`;

export class IsolateDetail extends React.Component {
    handleDownload = () => {
        followDownload(`/download/otus/${this.props.otuId}/isolates/${this.props.activeIsolate.id}`);
    };

    handleSetDefaultIsolate = () => {
        this.props.setIsolateAsDefault(this.props.otuId, this.props.activeIsolate.id);
    };

    render() {
        const isolate = this.props.activeIsolate;

        const defaultIsolateLabel =
            isolate.default & (this.props.dataType !== "barcode") ? (
                <Label color="green">
                    <Icon name="star" /> Default Isolate
                </Label>
            ) : null;

        let modifyIcons;

        if (this.props.canModify) {
            modifyIcons = (
                <span>
                    <Icon
                        name="pencil-alt"
                        color="orange"
                        tip="Edit Isolate"
                        tipPlacement="left"
                        onClick={this.props.showEditIsolate}
                        style={{ paddingLeft: "7px" }}
                    />
                    {!isolate.default & (this.props.dataType !== "barcode") ? (
                        <Icon
                            name="star"
                            color="green"
                            tip="Set as Default"
                            tipPlacement="left"
                            onClick={this.handleSetDefaultIsolate}
                            style={{ paddingLeft: "3px" }}
                        />
                    ) : null}
                    <Icon
                        name="trash"
                        color="red"
                        tip="Remove Isolate"
                        tipPlacement="left"
                        onClick={this.props.showRemoveIsolate}
                        style={{ paddingLeft: "3px" }}
                    />
                </span>
            );
        }

        const isolateComponent =
            this.props.dataType === "barcode" ? (
                <IsolateTargets />
            ) : (
                <IsolateSequences canModify={this.props.canModify} />
            );

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

                <IsolateDetailBox>
                    <IsolateDetailHeader>
                        <div>{isolate.name}</div>
                        <div>
                            {defaultIsolateLabel}
                            {modifyIcons}

                            <Icon
                                name="download"
                                tip="Download FASTA"
                                tipPlacement="left"
                                style={{ paddingLeft: "3px" }}
                                onClick={this.handleDownload}
                            />
                        </div>
                    </IsolateDetailHeader>
                    {isolateComponent}
                </IsolateDetailBox>
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
    canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu"),
    dataType: state.references.detail.data_type
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

export default connect(mapStateToProps, mapDispatchToProps)(IsolateDetail);
