import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup } from "../../base";
import JobStep from "./Step";

export const JobSteps = ({ status, task }) => {
    const currentIndex = status.length - 1;

    const stepComponents = map(status, (step, index) => (
        <JobStep key={index} complete={index < currentIndex} step={step} task={task} />
    ));

    return <BoxGroup>{stepComponents}</BoxGroup>;
};

export const mapStateToProps = state => {
    const { status, task } = state.jobs.detail;
    return {
        status,
        task
    };
};

export default connect(mapStateToProps)(JobSteps);
