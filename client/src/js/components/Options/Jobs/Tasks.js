/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Tasks
 */

import React from "react";
import { Row, Col, ListGroup } from "react-bootstrap";
import { ListGroupItem } from "virtool/js/components/Base";

import Task from "./Task";

const taskNames = ["import_reads", "rebuild_index", "add_host", "pathoscope_bowtie", "pathoscope_snap", "nuvs"];

/**
 * A list of items that contain form fields for modifying resource limits on specific tasks.
 */
const Tasks = (props) => {
    
    const taskComponents = taskNames.map((taskPrefix) =>
        <Task key={taskPrefix} taskPrefix={taskPrefix} {...props} />
    );

    const title = (
        <ListGroupItem key="title">
            <Row>
                <Col md={4}>CPU</Col>
                <Col md={4}>Memory (GB)</Col>
                <Col md={4}>Concurrent Jobs</Col>
            </Row>
        </ListGroupItem>
    );

    return (
        <ListGroup>
            {title}
            {taskComponents}
        </ListGroup>
    );
};

export default Tasks
