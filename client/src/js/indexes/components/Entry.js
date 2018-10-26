import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Label } from "react-bootstrap";
import { Icon, RelativeTime, ListGroupItem } from "../../base";
import { activeIndexIdSelector } from "../selectors";

export const IndexEntry = ({ activeId, documents, index, refId }) => {
    const document = documents[index];

    let activeIcon;

    // Decide what icon/text should be shown at the right end of the index document. If the index is building a
    // spinner with "Building" is shown, if the index is the active index a green check is shown. Otherwise, no
    // content is shown at the right.
    if (document.id === activeId) {
        if (document.ready) {
            activeIcon = (
                <span className="pull-right">
                    <Icon name="check" bsStyle="success" /> <strong>Active</strong>
                </span>
            );
        } else {
            activeIcon = (
                <div className="pull-right">
                    <ClipLoader size="14px" color="#3c8786" style={{ display: "inline" }} />
                    <strong> Building</strong>
                </div>
            );
        }
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
                    <Col md={3}>
                        <Label>Version {document.version}</Label>
                    </Col>
                    <Col md={3}>
                        Created <RelativeTime time={document.created_at} />
                    </Col>
                    <Col md={4}>{changeDescription}</Col>
                    <Col md={2}>{activeIcon}</Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
};

IndexEntry.propTypes = {
    index: PropTypes.number
};

const mapStateToProps = state => ({
    documents: state.indexes.documents,
    activeId: activeIndexIdSelector(state),
  refId: state.references.detail.id
});

export default connect(mapStateToProps)(IndexEntry);
