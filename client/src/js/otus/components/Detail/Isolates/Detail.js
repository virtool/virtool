import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Box, Icon, Label } from "../../../../base";
import { getCanModifyReferenceOTU } from "../../../../references/selectors";
import IsolateSequences from "../../../../sequences/components/Sequences";
import { followDownload } from "../../../../utils/utils";
import { setIsolateAsDefault, showEditIsolate, showRemoveIsolate } from "../../../actions";
import EditIsolate from "./Edit";
import RemoveIsolate from "./Remove";

const IsolateDetailHeader = styled(Box)`
    align-items: center;
    display: flex;
    font-size: ${props => props.theme.fontSize.lg};
    flex-direction: row;
    justify-content: space-between;

    div:first-child {
        font-weight: bold;
    }

    i.fas {
        padding-left: 5px;
    }
`;

const StyledIsolateDetail = styled.div`
    flex: 1;
    min-height: 0;
    min-width: 0;
`;

export class Detail extends React.Component {
    handleDownload = () => {
        followDownload(`/download/otus/${this.props.otuId}/isolates/${this.props.activeIsolate.id}`);
    };

    handleSetDefaultIsolate = () => {
        this.props.setIsolateAsDefault(this.props.otuId, this.props.activeIsolate.id);
    };

    render() {
        const isolate = this.props.activeIsolate;

        const defaultIsolateLabel = isolate.default && this.props.dataType !== "barcode" && (
            <Label color="green">
                <Icon name="star" /> Default Isolate
            </Label>
        );

        let modifyIcons;

        if (this.props.canModify) {
            modifyIcons = (
                <React.Fragment>
                    <Icon
                        name="pencil-alt"
                        color="orange"
                        tip="Edit Isolate"
                        tipPlacement="left"
                        onClick={this.props.showEditIsolate}
                    />
                    {!isolate.default && this.props.dataType !== "barcode" && (
                        <Icon
                            name="star"
                            color="green"
                            tip="Set as Default"
                            tipPlacement="left"
                            onClick={this.handleSetDefaultIsolate}
                        />
                    )}
                    <Icon
                        name="trash"
                        color="red"
                        tip="Remove Isolate"
                        tipPlacement="left"
                        onClick={this.props.showRemoveIsolate}
                    />
                </React.Fragment>
            );
        }

        return (
            <StyledIsolateDetail>
                <EditIsolate
                    key={isolate.id}
                    otuId={this.props.otuId}
                    isolateId={isolate.id}
                    sourceType={isolate.source_type}
                    sourceName={isolate.source_name}
                />

                <RemoveIsolate />

                <IsolateDetailHeader>
                    <div>{isolate.name}</div>
                    <div>
                        {defaultIsolateLabel}
                        {modifyIcons}
                        <Icon name="download" tip="Download FASTA" tipPlacement="left" onClick={this.handleDownload} />
                    </div>
                </IsolateDetailHeader>

                <IsolateSequences canModify={this.props.canModify} />
            </StyledIsolateDetail>
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
    canModify: getCanModifyReferenceOTU(state),
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

export default connect(mapStateToProps, mapDispatchToProps)(Detail);
