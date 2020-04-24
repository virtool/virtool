import { get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, Box, BoxGroup, NoneFoundBox, SectionHeader } from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { selectIsolate, showAddIsolate } from "../../actions";
import IsolateButton from "./Isolates/Item";
import IsolateDetail from "./Isolates/Detail";

const StyledIsolateEditor = styled.div`
    h4 > a {
        font-size: 14px;
    }
`;

const IsolateEditorContainer = styled.div`
    display: flex;
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
    flex: 0 0 auto;
    height: 420px;
    margin: 0 15px 0 0;
    padding: 0;
    overflow-y: scroll;
    width: 240px;
`;

const IsolateEditorList = styled(BoxGroup)`
    border: none;
    box-shadow: ${props => props.theme.boxShadow.inset};
    width: 100%;
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
        return <NoneFoundBox noun="isolates">{addIsolateLink}.</NoneFoundBox>;
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

export default connect(mapStateToProps, mapDispatchToProps)(IsolateEditor);
