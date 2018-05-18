import React from "react";
import { map, sortBy } from "lodash-es";
import { Row, Col, ListGroup, ListGroupItem, Panel } from "react-bootstrap";

import { LoadingPlaceholder } from "../../base";

export default function RebuildHistory ({ unbuilt, error }) {

    let content;

    if (unbuilt === null) {
        content = <LoadingPlaceholder margin="22px" />;
    } else {
        const historyComponents = map(sortBy(unbuilt.documents, "otu.name"), change =>
            <ListGroupItem key={change.id}>
                <Row>
                    <Col md={5}>
                        <strong>{change.otu.name}</strong>
                    </Col>
                    <Col md={7}>
                        {change.description || "No Description"}
                    </Col>
                </Row>
            </ListGroupItem>
        );

        content = (
            <ListGroup style={{overflowY: "auto", maxHeight: "700px"}}>
                {historyComponents}
            </ListGroup>
        );
    }

    const panelStyle = error ? "panel-danger" : "panel-default";

    return (
        <Panel className={panelStyle}>
            <Panel.Heading>Changes</Panel.Heading>
            <Panel.Body>
                {content}
            </Panel.Body>
        </Panel>
    );
}
