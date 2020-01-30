import { get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import styled from "styled-components";
import { Badge, Box, BoxGroup, Icon, SectionHeader } from "../../../base";

import { checkRefRight } from "../../../utils/utils";
import { selectIsolate, showAddIsolate } from "../../actions";
import IsolateButton from "./IsolateButton";
import IsolateDetail from "./IsolateDetail";

const StyledIsolateEditor = styled.div`
    h4 > a {
        font-size: 14px;
    }
`;

const IsolateEditorContainer = styled.div`
    display: grid;
    grid-gap: 10px;
    grid-template-columns: minmax(230px, 1fr) 3fr;
`;

const IsolateEditorEmpty = styled(Box)`
    text-align: center;
    padding: 50px 0;
`;

const IsolateEditorHeader = styled(SectionHeader)`
    align-items: center;
    display: flex;

    strong {
        padding-right: 5px;
    }

    a {
        margin-left: auto;
        font-size: 14px;
        font-weight: bold;
    }
`;

const IsolateEditorListContainer = styled(Box)`
    height: 420px;
    padding: 0;
    overflow-y: scroll;
`;

const IsolateEditorList = styled(BoxGroup)`
    border: none;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    margin-bottom: 0;
`;

const IsolateEditor = props => {
    const isolateComponents = map(props.isolates, (isolate, index) => (
        <IsolateButton
            key={index}
            {...isolate}
            active={isolate.id === props.activeIsolateId}
            onClick={props.onSelectIsolate}
        />
    ));

    const addIsolateLink = props.canModify ? (
        <a href="#" onClick={props.onShowAddIsolate}>
            Add Isolate
        </a>
    ) : null;

    if (isolateComponents.length === 0) {
        return (
            <IsolateEditorEmpty>
                <Icon name="flask" /> <strong>No Isolates</strong>. {addIsolateLink}.
            </IsolateEditorEmpty>
        );
    }

    return (
        <StyledIsolateEditor>
            <IsolateEditorHeader>
                <strong>Isolates</strong>
                <Badge>{isolateComponents.length}</Badge>
                {addIsolateLink}
            </IsolateEditorHeader>

            <IsolateEditorContainer>
                <IsolateEditorListContainer>
                    <IsolateEditorList>{isolateComponents}</IsolateEditorList>
                </IsolateEditorListContainer>
                <IsolateDetail canModify={props.canModify} />
            </IsolateEditorContainer>
        </StyledIsolateEditor>
    );
};

const mapStateToProps = state => ({
    otuId: state.otus.detail.id,
    isolates: state.otus.detail.isolates,
    activeIsolateId: state.otus.activeIsolateId,
    isRemote: state.references.detail.remotes_from,
    canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu")
});

const mapDispatchToProps = dispatch => ({
    onSelectIsolate: isolateId => {
        dispatch(selectIsolate(isolateId));
    },

    onShowAddIsolate: () => {
        dispatch(showAddIsolate());
    }
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(IsolateEditor));
