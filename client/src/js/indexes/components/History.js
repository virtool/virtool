/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IndexRebuild
 */

import React from "react";
import PropTypes from "prop-types";
import { sortBy } from "lodash";
import { ScaleLoader } from "halogen";
import { Row, Col, ListGroup, ListGroupItem, Panel } from "react-bootstrap";

const RebuildHistory = (props) => {

    if (props.unbuilt === null) {
        return (
            <Panel header="Changes">
                <ScaleLoader />
            </Panel>
        );
    }

    const historyComponents = sortBy(props.unbuilt.history, "virus.name").map((change) =>
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


    return (
        <Panel header="Changes">
            <ListGroup style={{overflowY: "auto", maxHeight: "700px"}} fill>
                {historyComponents}
            </ListGroup>
        </Panel>
    );
};

RebuildHistory.propTypes = {
    unbuilt: PropTypes.object
};

export default RebuildHistory;
