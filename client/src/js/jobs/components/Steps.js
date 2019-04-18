import { map } from "lodash-es";
import React from "react";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import JobStep from "./Step";

export const JobSteps = ({ status, task }) => {
    const currentIndex = status.length - 1;

    const stepComponents = map(status, (step, index) => (
        <JobStep key={index} complete={index < currentIndex} step={step} task={task} />
    ));

    return <ListGroup>{stepComponents}</ListGroup>;
};

export const mapStateToProps = state => {
    const { status, task } = state.jobs.detail;
    return {
        status,
        task
    };
};

export default connect(mapStateToProps)(JobSteps);
