import React from "react";
import { forEach, map } from "lodash-es";
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

    // console.log("Task limits: ", props.procLowerLimit, props.memLowerLimit, props.resourceProc, props.resourceMem);

    const taskComponents = map(taskNames, taskPrefix =>
        <Task
            key={taskPrefix}
            taskPrefix={taskPrefix}
            proc={props.limits[taskPrefix].proc}
            mem={props.limits[taskPrefix].mem}
            inst={props.limits[taskPrefix].inst}
            onChangeLimit={props.onChangeLimit}
            procLowerLimit={props.procLowerLimit}
            memLowerLimit={props.memLowerLimit}
            currentLimitProc={props.resourceProc}
            currentLimitMem={props.resourceMem}
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

    forEach(taskNames, taskName => {
        limits[taskName] = {
            proc: state.settings.data[`${taskName}_proc`],
            mem: state.settings.data[`${taskName}_mem`],
            inst: state.settings.data[`${taskName}_inst`]
        };
    });

    const settings = {
        procLowerLimit: state.settings.data.rebuild_index_proc,
        memLowerLimit: state.settings.data.rebuild_index_mem,
        resourceProc: state.settings.data.proc,
        resourceMem: state.settings.data.mem
    };

    return {limits, ...settings};
};

const mapDispatchToProps = (dispatch) => ({

    onChangeLimit: (taskPrefix, key, value) => {
        console.log("taskprefix: ", taskPrefix, ", key: ", key, ", value: ", value);
        dispatch(updateSetting(`${taskPrefix}_${key}`, value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(TaskLimits);
