import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Attribution, Icon, LinkBox, Loader } from "../../base";
import { getActiveIndexId } from "../selectors";

export const IndexItemChangeDescription = ({ changeCount, modifiedCount }) => {
    if (changeCount === null) {
        return null;
    }

    if (changeCount === 0) {
        return "No changes";
    }

    return (
        <span>
            {changeCount} change{changeCount === 1 ? "" : "s"} made in {modifiedCount} OTU
            {modifiedCount === 1 ? "" : "s"}
        </span>
    );
};

const IndexItemTop = styled.h3`
    display: flex;
    font-size: ${getFontSize("lg")};
    margin: 0;

    > strong {
        flex: 1 1 120px;
        font-weight: ${getFontWeight("thick")};
        max-width: 40%;
    }

    > span {
        flex: 1 0 auto;
        font-weight: ${getFontWeight("normal")};
    }

    > div {
        flex: 1 0 auto;
        max-width: 70px;
    }
`;

const StyledIndexItemIcon = styled.div`
    margin-left: auto;
    text-align: right;
`;

export const IndexItemIcon = ({ activeId, id, ready }) => {
    if (ready) {
        if (id === activeId) {
            return (
                <StyledIndexItemIcon>
                    <Icon name="check" color="green" /> <strong>Active</strong>
                </StyledIndexItemIcon>
            );
        }

        return null;
    }

    return (
        <StyledIndexItemIcon>
            <Loader size="14px" color="primary" />
            <strong> Building</strong>
        </StyledIndexItemIcon>
    );
};

export const IndexItem = ({ activeId, document, refId }) => (
    <LinkBox to={`/refs/${refId}/indexes/${document.id}`}>
        <IndexItemTop>
            <strong>Version {document.version}</strong>
            <IndexItemChangeDescription
                changeCount={document.change_count}
                modifiedCount={document.modified_otu_count}
            />
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
