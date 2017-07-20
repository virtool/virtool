/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobOptions
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Panel } from "react-bootstrap";

import { updateSettings } from "../../actions";
import { Flex, FlexItem, ListGroupItem, Icon } from "virtool/js/components/Base";

import Task from "./Task";

const taskNames = ["import_reads", "rebuild_index", "add_host", "pathoscope_bowtie", "nuvs"];

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

/**
 * A component the contains child components that modify options for resource limits on the server and on specific
 * tasks.
 */
const TaskLimits = (props) => {

    const taskComponents = taskNames.map(taskPrefix => {
        return (
            <Task
                key={taskPrefix}
                taskPrefix={taskPrefix}
                proc={props.limits[taskPrefix].proc}
                mem={props.limits[taskPrefix].mem}
                inst={props.limits[taskPrefix].inst}
                onChangeLimit={props.onChangeLimit}
            />
        );
    });

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

TaskLimits.propTypes = {
    limits: React.PropTypes.object,
    onChangeLimit: React.PropTypes.func
};

const mapStateToProps = (state) => {
    let limits = {};

    taskNames.forEach(taskName => {
        limits[taskName] = {
            proc: state.settings.data[`${taskName}_proc`],
            mem: state.settings.data[`${taskName}_mem`],
            inst: state.settings.data[`${taskName}_inst`]
        };
    });

    return {
        limits: limits
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onChangeLimit: (taskPrefix, key, value) => {
            let update = {};
            update[`${taskPrefix}_${key}`] = value;
            dispatch(updateSettings(update));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(TaskLimits);

export default Container;
