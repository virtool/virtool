import React from "react";
import PropTypes from "prop-types";
import { includes } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { ListGroupItem } from "../../../base";
import { getTaskDisplayName } from "../../../utils";

import TaskField from "./TaskField";

const readOnlyFields = ["create_subtraction", "rebuild_index"];

class Task extends React.Component {

    handleChangeLimit = (value) => {
        this.props.onChangeLimit(this.props.taskPrefix, "proc", value);
    };

    render () {

        const { inst, mem, proc, taskPrefix } = this.props;

        const readOnly = includes(readOnlyFields, taskPrefix);

        return (
            <ListGroupItem allowFocus>
                <h5><strong>{getTaskDisplayName(taskPrefix)}</strong></h5>
                <Row>
                    <Col md={4}>
                        <TaskField
                            value={proc}
                            readOnly={readOnly}
                            onChange={this.handleChangeLimit}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            value={mem}
                            readOnly={readOnly}
                            onChange={this.handleChangeLimit}
                        />
                    </Col>
                    <Col md={4}>
                        <TaskField
                            value={inst}
                            readOnly={taskPrefix === "rebuild_index"}
                            onChange={this.handleChangeLimit}
                        />
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}

Task.propTypes = {
    taskPrefix: PropTypes.string.isRequired,
    proc: PropTypes.number,
    mem: PropTypes.number,
    inst: PropTypes.number,
    onChangeLimit: PropTypes.func
};

export default Task;
