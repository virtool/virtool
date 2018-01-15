import React from "react";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Flex, FlexItem, ListGroupItem, Icon } from "../../../base";
import Task from "./Task";

const taskNames = [
    "create_sample",
    "rebuild_index",
    "create_subtraction",
    "pathoscope_bowtie",
    "nuvs"
];

const TasksFooter = () => (
    <small>
        <Flex className="text-warning" style={{marginBottom: "8px"}}>
            <FlexItem grow={0} shrink={0}>
                <Icon name="warning" />
            </FlexItem>
            <FlexItem grow={1} pad>
                Changing CPU and memory settings will not affect jobs that have already been initialized.
            </FlexItem>
        </Flex>
        <Flex className="text-danger">
            <FlexItem grow={0} shrink={0}>
                <Icon name="warning" />
            </FlexItem>
            <FlexItem grow={1} pad>
                 Setting task-specific limits higher than system resource limits will prevent jobs from starting.
            </FlexItem>
        </Flex>
    </small>
);

const TaskLimits = (props) => {

    const taskComponents = taskNames.map(taskPrefix =>
        <Task
            key={taskPrefix}
            taskPrefix={taskPrefix}
            proc={props.limits[taskPrefix].proc}
            mem={props.limits[taskPrefix].mem}
            inst={props.limits[taskPrefix].inst}
            onChangeLimit={props.onChangeLimit}
        />
    );

    return (
        <Row>
            <Col md={12}>
                <h5><strong>Task-specific Limits</strong></h5>
            </Col>
            <Col md={6}>
                <ListGroup>
                    <ListGroupItem key="title">
                        <Row>
                            <Col md={4}>CPU</Col>
                            <Col md={4}>Memory (GB)</Col>
                            <Col md={4}>Instances</Col>
                        </Row>
                    </ListGroupItem>
                    {taskComponents}
                </ListGroup>
            </Col>
            <Col md={6}>
                <Panel footer={<TasksFooter />}>
                    Set limits on specific tasks.
                </Panel>
            </Col>
        </Row>
    );
};

const mapStateToProps = (state) => {
    const limits = {};

    taskNames.forEach(taskName => {
        limits[taskName] = {
            proc: state.settings.data[`${taskName}_proc`],
            mem: state.settings.data[`${taskName}_mem`],
            inst: state.settings.data[`${taskName}_inst`]
        };
    });

    return {limits};
};

const mapDispatchToProps = (dispatch) => ({

    onChangeLimit: (taskPrefix, key, value) => {
        dispatch(updateSetting(`${taskPrefix}_${key}`, value));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(TaskLimits);

export default Container;
