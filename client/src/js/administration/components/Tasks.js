import React from "react";
import { forEach, map } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, ListGroup } from "react-bootstrap";
import AdministrationSection from "./Section";
import { updateSetting } from "../actions";
import { ListGroupItem, Icon } from "../../base/index";
import { readOnlyFields, maxResourcesSelector, minResourcesSelector } from "../selectors";
import Task from "./Task";

const taskNames = ["create_sample", "build_index", "create_subtraction", "pathoscope_bowtie", "nuvs"];

export const TasksFooter = () => (
    <small className="text-warning">
        <Icon name="exclamation-triangle" /> Changing CPU and memory settings will not affect jobs that have already
        been initialized.
    </small>
);

export const TaskLimits = props => {
    const taskComponents = map(taskNames, taskPrefix => (
        <Task
            key={taskPrefix}
            taskPrefix={taskPrefix}
            proc={props.limits[taskPrefix].proc}
            mem={props.limits[taskPrefix].mem}
            inst={props.limits[taskPrefix].inst}
            onChangeLimit={props.onChangeLimit}
            minProc={props.minProc}
            minMem={props.minMem}
            resourceProc={props.resourceProc}
            resourceMem={props.resourceMem}
            readOnlyFields={readOnlyFields}
        />
    ));

    const content = (
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
    );

    return (
        <AdministrationSection
            title="Task-specific Limits"
            description="Set limits on specific tasks."
            footerComponent={<TasksFooter />}
            content={content}
        />
    );
};

const mapStateToProps = state => {
    const limits = {};

    forEach(taskNames, taskName => {
        limits[taskName] = {
            proc: state.settings.data[`${taskName}_proc`],
            mem: state.settings.data[`${taskName}_mem`],
            inst: state.settings.data[`${taskName}_inst`]
        };
    });

    const { maxProc, maxMem } = maxResourcesSelector(state);
    const { minProc, minMem } = minResourcesSelector(state);

    const settings = {
        resourceProc: state.settings.data.proc,
        resourceMem: state.settings.data.mem,
        maxProc,
        maxMem,
        minProc,
        minMem
    };

    return { limits, ...settings };
};

const mapDispatchToProps = dispatch => ({
    onChangeLimit: (taskPrefix, key, value) => {
        dispatch(updateSetting(`${taskPrefix}_${key}`, value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TaskLimits);
