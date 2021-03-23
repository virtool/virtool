import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../../app/theme";
import { Badge, Box, BoxGroup, NoneFoundBox, SubviewHeader, SubviewHeaderTitle } from "../../../base";
import { getCanModifyReferenceOTU } from "../../../references/selectors";
import { selectIsolate, showAddIsolate } from "../../actions";
import IsolateDetail from "./Isolates/Detail";
import IsolateItem from "./Isolates/Item";

const IsolateEditorContainer = styled.div`
    display: flex;
`;

const IsolateEditorTitle = styled(SubviewHeaderTitle)`
    align-items: center;
    display: flex;

    strong {
        padding-right: 5px;
    }

    a {
        align-self: flex-end;
        font-size: ${getFontSize("md")};
        font-weight: ${getFontWeight("thick")};
        margin-left: auto;
    }

    ${Badge} {
        font-size: ${getFontSize("md")};
        margin-left: 5px;
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
    let body;

    const isolateComponents = map(props.isolates, (isolate, index) => (
        <IsolateItem
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
        body = <NoneFoundBox noun="isolates" />;
    } else {
        body = (
            <IsolateEditorContainer>
                <IsolateEditorListContainer>
                    <IsolateEditorList>{isolateComponents}</IsolateEditorList>
                </IsolateEditorListContainer>
                <IsolateDetail canModify={props.canModify} />
            </IsolateEditorContainer>
        );
    }

    return (
        <React.Fragment>
            <SubviewHeader>
                <IsolateEditorTitle>
                    Isolates <Badge>{isolateComponents.length}</Badge>
                    {addIsolateLink}
                </IsolateEditorTitle>
            </SubviewHeader>
            {body}
        </React.Fragment>
    );
};

const mapStateToProps = state => ({
    otuId: state.otus.detail.id,
    isolates: state.otus.detail.isolates,
    activeIsolateId: state.otus.activeIsolateId,
    isRemote: state.references.detail.remotes_from,
    canModify: getCanModifyReferenceOTU(state)
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
