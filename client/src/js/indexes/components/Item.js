import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import styled from "styled-components";
import { Icon, RelativeTime, SpacedBox, Loader } from "../../base";
import { getActiveIndexId } from "../selectors";

const IndexItems = styled(SpacedBox)`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
`;

export const IndexItemChangeDescription = ({ changeCount, modifiedCount }) => {
    if (changeCount === null) {
        return null;
    }

    // Text to show if no changes occurred since the last index build. Technically, should never be shown
    // because the rebuild button is not shown if no changes have been made.
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

export const IndexItemIcon = ({ activeId, id, ready }) => {
    // Decide what icon/text should be shown at the right end of the index document. If the index is building a
    // spinner with "Building" is shown, if the index is the active index a green check is shown. Otherwise, no
    // content is shown at the right.
    if (ready) {
        if (id === activeId) {
            return (
                <span className="pull-right">
                    <Icon name="check" color="green" /> <strong>Active</strong>
                </span>
            );
        }

        return null;
    }

    return (
        <div className="pull-right">
            <Loader size="14px" color="#3c8786" />
            <strong> Building</strong>
        </div>
    );
};

export const IndexItem = ({ activeId, document, refId }) => (
    <LinkContainer to={`/refs/${refId}/indexes/${document.id}`} className="spaced">
        <IndexItems>
            <strong>Version {document.version}</strong>
            <span>
                Created <RelativeTime time={document.created_at} />
            </span>
            <IndexItemChangeDescription
                changeCount={document.change_count}
                modifiedCount={document.modified_otu_count}
            />
            <IndexItemIcon activeId={activeId} id={document.id} ready={document.ready} />
        </IndexItems>
    </LinkContainer>
);

export const mapStateToProps = (state, props) => ({
    document: state.indexes.documents[props.index],
    activeId: getActiveIndexId(state),
    refId: state.references.detail.id
});

export default connect(mapStateToProps)(IndexItem);
