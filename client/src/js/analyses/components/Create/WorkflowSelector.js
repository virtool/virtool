import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { BoxGroup } from "../../../base";
import { WorkflowSelectorItem } from "./WorkflowSelectorItem";

export const getCompatibleWorkflows = (dataType, hasHmm) => {
    if (dataType === "barcode") {
        return ["aodp"];
    }

    if (hasHmm) {
        return ["pathoscope_bowtie", "nuvs"];
    }

    return ["pathoscope_bowtie"];
};

export const WorkflowSelector = ({ dataType, hasHmm, workflows, onSelect }) => {
    const workflowComponents = map(getCompatibleWorkflows(dataType, hasHmm), workflow => (
        <WorkflowSelectorItem
            key={workflow}
            active={workflows.includes(workflow)}
            workflow={workflow}
            onSelect={onSelect}
        />
    ));

    return (
        <React.Fragment>
            <label>Workflows</label>
            <BoxGroup>{workflowComponents}</BoxGroup>
        </React.Fragment>
    );
};

WorkflowSelector.propTypes = {
    dataType: PropTypes.oneOf(["barcode", "genome"]),
    hasHmm: PropTypes.bool,
    workflows: PropTypes.arrayOf(PropTypes.string),
    onSelect: PropTypes.func.isRequired
};
