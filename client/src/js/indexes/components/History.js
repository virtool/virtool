import { map, sortBy } from "lodash-es";
import React from "react";
import { Col, ListGroup, ListGroupItem, Row } from "react-bootstrap";
import styled from "styled-components";
import { LoadingPlaceholder, Panel } from "../../base";

const StyledRebuildHistoryEllipsis = styled(ListGroupItem)`
    text-align: right;
`;

export const RebuildHistoryEllipsis = ({ unbuilt }) => {
    if (unbuilt.page_count > 1) {
        return (
            <StyledRebuildHistoryEllipsis key="last-item">
                + {unbuilt.total_count - unbuilt.per_page} more changes
            </StyledRebuildHistoryEllipsis>
        );
    }

    return null;
};

export const RebuildHistoryItem = ({ description, otuName }) => (
    <ListGroupItem>
        <Row>
            <Col md={5}>
                <strong>{otuName}</strong>
            </Col>
            <Col md={7}>{description || "No Description"}</Col>
        </Row>
    </ListGroupItem>
);

export default function RebuildHistory({ unbuilt, error }) {
    let content;

    if (unbuilt === null) {
        content = <LoadingPlaceholder margin="22px" />;
    } else {
        const historyComponents = map(sortBy(unbuilt.documents, "otu.name"), change => (
            <RebuildHistoryItem key={change.id} description={change.description} otuName={change.otu.name} />
        ));

        content = (
            <ListGroup style={{ overflowY: "auto", maxHeight: "700px" }}>
                {historyComponents}
                <RebuildHistoryEllipsis unbuilt={unbuilt} />
            </ListGroup>
        );
    }

    const panelStyle = error ? "panel-danger" : "panel-default";

    return (
        <Panel className={panelStyle}>
            <Panel.Heading>Changes</Panel.Heading>
            {content}
        </Panel>
    );
}
