import React from "react";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem } from "../../../base";
import { getTaskDisplayName } from "../../../utils";

import TaskField from "./TaskField";

const readOnlyFields = ["create_subtraction", "rebuild_index"];

const Task = (props) => {

    const readOnly = readOnlyFields.includes(props.taskPrefix);

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
    taskPrefix: PropTypes.string.isRequired,
    proc: PropTypes.number,
    mem: PropTypes.number,
    inst: PropTypes.number,
    onChangeLimit: PropTypes.func
};

export default Task;
