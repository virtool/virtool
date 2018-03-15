import React from "react";
import { map, sortBy } from "lodash-es";
import { Row, Col, ListGroup, ListGroupItem, Panel } from "react-bootstrap";

import { LoadingPlaceholder } from "../../base";

export default function RebuildHistory ({ unbuilt, error }) {

    let content;

    if (unbuilt === null) {
        content = <LoadingPlaceholder margin="22px" />;
    } else {
        const historyComponents = map(sortBy(unbuilt.history, "virus.name"), change =>
            <ListGroupItem key={change.id}>
                <Row>
                    <Col md={5}>
                        <strong>{change.virus.name}</strong>
                    </Col>
                    <Col md={7}>
                        {change.description || "No Description"}
                    </Col>
                </Row>
            </ListGroupItem>
        );

        content = (
            <ListGroup style={{overflowY: "auto", maxHeight: "700px"}} fill>
                {historyComponents}
            </ListGroup>
        );
    }

    const panelStyle = error ? "panel-danger" : "panel-default";

    return (
        <Panel className={panelStyle} header="Changes">
            {content}
        </Panel>
    );
}
