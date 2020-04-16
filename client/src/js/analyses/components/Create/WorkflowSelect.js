import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { InputGroup, InputLabel, Select } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";

export const getCompatibleWorkflows = libraryType => {
    if (libraryType === "amplicon") {
        return ["aodp"];
    }

    return ["pathoscope_bowtie", "nuvs"];
};

/**
 * An input-based component for selecting an worklfow (eg. pathoscope_bowtie), by its display name
 * (eg. Pathoscope Bowtie).
 *
 */
export const WorkflowSelect = ({ hasHmm, libraryType, value, onChange }) => {
    const optionComponents = map(getCompatibleWorkflows(libraryType), workflow => (
        <option key={workflow} value={workflow} disabled={workflow === "nuvs" && !hasHmm}>
            {getTaskDisplayName(workflow)}
        </option>
    ));

    return (
        <InputGroup>
            <InputLabel>Workflow</InputLabel>
            <Select name="workflow" value={value} onChange={onChange}>
                {optionComponents}
            </Select>
        </InputGroup>
    );
};

WorkflowSelect.propTypes = {
    libraryType: PropTypes.string.isRequired,
    value: PropTypes.oneOf(["pathoscope_bowtie", "nuvs", "aodp"]),
    onChange: PropTypes.func,
    hasHmm: PropTypes.bool
};
