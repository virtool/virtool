import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../../../base/MultiSelector";
import { getTaskDisplayName } from "../../../utils/utils";

export const getCompatibleWorkflows = (dataType, hasHmm) => {
    if (dataType === "barcode") {
        return ["aodp"];
    }

    if (hasHmm) {
        return ["pathoscope_bowtie", "nuvs"];
    }

    return ["pathoscope_bowtie"];
};

export const WorkflowSelector = ({ dataType, hasError, hasHmm, workflows, onSelect }) => {
    const workflowItems = map(getCompatibleWorkflows(dataType, hasHmm), workflow => (
        <MultiSelectorItem key={workflow} name={workflow} value={workflow}>
            {getTaskDisplayName(workflow)}
        </MultiSelectorItem>
    ));

    return (
        <React.Fragment>
            <label htmlFor="workflow-selector">Workflows</label>
            <MultiSelector
                error={hasError && "Workflow(s) must be selected"}
                id="workflow-selector"
                noun="workflows"
                selected={workflows}
                onChange={onSelect}
            >
                {workflowItems}
            </MultiSelector>
        </React.Fragment>
    );
};

WorkflowSelector.propTypes = {
    dataType: PropTypes.oneOf(["barcode", "genome"]),
    hasError: PropTypes.bool,
    hasHmm: PropTypes.bool,
    workflows: PropTypes.arrayOf(PropTypes.string),
    onSelect: PropTypes.func.isRequired
};
