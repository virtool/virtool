import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup } from "../../base";
import JobStep from "./Step";

export const JobSteps = ({ status, workflow }) => {
    const currentIndex = status.length - 1;

    const stepComponents = map(status, (step, index) => (
        <JobStep key={index} complete={index < currentIndex} step={step} workflow={workflow} />
    ));

    return <BoxGroup>{stepComponents}</BoxGroup>;
};

export const mapStateToProps = state => {
    const { status, workflow } = state.jobs.detail;
    return {
        status,
        workflow
    };
};

export default connect(mapStateToProps)(JobSteps);
