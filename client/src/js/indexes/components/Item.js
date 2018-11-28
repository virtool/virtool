import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Label } from "react-bootstrap";
import { Icon, RelativeTime, ListGroupItem, Loader } from "../../base";
import { activeIndexIdSelector } from "../selectors";

export const IndexEntry = ({ activeId, document, refId }) => {
    let activeIcon;

    // Decide what icon/text should be shown at the right end of the index document. If the index is building a
    // spinner with "Building" is shown, if the index is the active index a green check is shown. Otherwise, no
    // content is shown at the right.
    if (document.id === activeId && document.ready) {
        activeIcon = (
            <span className="pull-right">
                <Icon name="check" bsStyle="success" /> <strong>Active</strong>
            </span>
        );
    }

    if (!document.ready) {
        activeIcon = (
            <div className="pull-right">
                <Loader size="14px" color="#3c8786" style={{ display: "inline" }} />
                <strong> Building</strong>
            </div>
        );
    }

    // The description of
    let changeDescription;

    if (document.change_count !== null) {
        // Text to show if no changes occurred since the last index build. Technically, should never be shown
        // because the rebuild button is not shown if no changes have been made.
        changeDescription = "No changes";

        // This should always test true in practice. Shows the number of changes and the number of OTUs
        // affected.
        if (document.change_count > 0) {
            changeDescription = (
                <span>
                    {document.change_count} {" changes made in "}
                    {document.modified_otu_count} {document.modified_otu_count === 1 ? "OTU" : "OTUs"}
                </span>
            );
        }
    }

    return (
        <LinkContainer to={`/refs/${refId}/indexes/${document.id}`} className="spaced">
            <ListGroupItem>
                <Row>
                    <Col xs={3}>
                        <strong>Version {document.version}</strong>
                    </Col>
                    <Col xs={3}>
                        Created <RelativeTime time={document.created_at} />
                    </Col>
                    <Col md={4} xsHidden smHidden>
                        {changeDescription}
                    </Col>
                    <Col xs={6} md={2}>
                        {activeIcon}
                    </Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
};

const mapStateToProps = (state, ownProps) => ({
    document: state.indexes.documents[ownProps.index],
    activeId: activeIndexIdSelector(state),
    refId: state.references.detail.id
});

export default connect(mapStateToProps)(IndexEntry);
