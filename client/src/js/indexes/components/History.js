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

import React, { PropTypes } from "react";
import { sortBy } from "lodash";
import { Row, Col, ListGroup, ListGroupItem, Panel } from "react-bootstrap";

import { Spinner } from "virtool/js/components/Base";

const RebuildHistory = (props) => {

    if (props.unbuilt === null) {
        return (
            <Panel header="Changes">
                <div className="text-center">
                    <Spinner color="#777777" />
                </div>
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
