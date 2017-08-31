/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Task
 */

import React from "react";
import { includes } from "lodash";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem } from "virtool/js/components/Base";
import { getTaskDisplayName } from "virtool/js/utils";

import TaskField from "./TaskField";

/**
 * A ListGroupItem-based form component that allows editing of task-specific resource limits in form child components.
 */
const Task = (props) => {

    const readOnly = includes(["create_subtraction", "rebuild_index"], props.taskPrefix);

    return (
        <ListGroupItem allowFocus>
            <h5><strong>{getTaskDisplayName(props.taskPrefix)}</strong></h5>
            <Row>
                <Col md={4}>
                    <TaskField
                        value={props.proc}
                        readOnly={readOnly}
                        onChange={(value) => {props.onChangeLimit(props.taskPrefix, "proc", value)}}
                    />
                </Col>
                <Col md={4}>
                    <TaskField
                        value={props.mem}
                        readOnly={readOnly}
                        onChange={(value) => {props.onChangeLimit(props.taskPrefix, "mem", value)}}
                    />
                </Col>
                <Col md={4}>
                    <TaskField
                        value={props.inst}
                        readOnly={props.taskPrefix === "rebuild_index"}
                        onChange={(value) => {props.onChangeLimit(props.taskPrefix, "inst", value)}}
                    />
                </Col>
            </Row>
        </ListGroupItem>
    );
};

Task.propTypes = {
    taskPrefix: React.PropTypes.string.isRequired,
    proc: React.PropTypes.number,
    mem: React.PropTypes.number,
    inst: React.PropTypes.number,
    onChangeLimit: React.PropTypes.func
};

export default Task;
