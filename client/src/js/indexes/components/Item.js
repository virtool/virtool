import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Icon, RelativeTime, Loader, LinkBox } from "../../base";
import { getActiveIndexId } from "../selectors";

const StyledIndexItem = styled(LinkBox)`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
`;

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

const StyledIndexItemIcon = styled.div`
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
            <Loader size="14px" color="#3c8786" />
            <strong> Building</strong>
        </StyledIndexItemIcon>
    );
};

export const IndexItem = ({ activeId, document, refId }) => (
    <StyledIndexItem to={`/refs/${refId}/indexes/${document.id}`}>
        <strong>Version {document.version}</strong>
        <span>
            Created <RelativeTime time={document.created_at} />
        </span>
        <IndexItemChangeDescription changeCount={document.change_count} modifiedCount={document.modified_otu_count} />
        <IndexItemIcon activeId={activeId} id={document.id} ready={document.ready} />
    </StyledIndexItem>
);

export const mapStateToProps = (state, props) => ({
    document: state.indexes.documents[props.index],
    activeId: getActiveIndexId(state),
    refId: state.references.detail.id
});

export default connect(mapStateToProps)(IndexItem);
