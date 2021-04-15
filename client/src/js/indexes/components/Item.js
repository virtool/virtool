import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { fontWeight, getFontSize } from "../../app/theme";
import { Attribution, Icon, LinkBox, Loader } from "../../base";
import { getActiveIndexId } from "../selectors";

const StyledIndexItemDescription = styled.span`
    font-weight: ${fontWeight.normal};
`;

export const IndexItemDescription = ({ changeCount, modifiedCount }) => {
    if (changeCount === null) {
        return null;
    }

    if (changeCount === 0) {
        return "No changes";
    }

    return (
        <StyledIndexItemDescription>
            {changeCount} change{changeCount === 1 ? "" : "s"} made in {modifiedCount} OTU
            {modifiedCount === 1 ? "" : "s"}
        </StyledIndexItemDescription>
    );
};

const IndexItemTop = styled.h3`
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${fontWeight.thick};
    margin: 0 0 5px;
`;

const StyledIndexItemIcon = styled.div`
    margin-left: auto;
    text-align: right;
    width: 85px;
`;

export const IndexItemIcon = ({ activeId, id, ready }) => {
    if (ready) {
        if (id === activeId) {
            return (
                <StyledIndexItemIcon>
                    <Icon name="check" color="green" /> <span>Active</span>
                </StyledIndexItemIcon>
            );
        }

        return null;
    }

    return (
        <StyledIndexItemIcon>
            <Loader size="14px" color="primary" />
            <span> Building</span>
        </StyledIndexItemIcon>
    );
};

const IndexItemVersion = styled.strong`
    flex: 1 0 auto;
    font-weight: ${fontWeight.thick};
    max-width: 40%;
`;

export const IndexItem = ({ activeId, document, refId }) => (
    <LinkBox to={`/refs/${refId}/indexes/${document.id}`}>
        <IndexItemTop>
            <IndexItemVersion>Version {document.version}</IndexItemVersion>
            <IndexItemDescription changeCount={document.change_count} modifiedCount={document.modified_otu_count} />
            <IndexItemIcon activeId={activeId} id={document.id} ready={document.ready} />
        </IndexItemTop>
        <Attribution time={document.created_at} user={document.user.id} />
    </LinkBox>
);

export const mapStateToProps = (state, props) => ({
    document: state.indexes.documents[props.index],
    activeId: getActiveIndexId(state),
    refId: state.references.detail.id
});

export default connect(mapStateToProps)(IndexItem);
