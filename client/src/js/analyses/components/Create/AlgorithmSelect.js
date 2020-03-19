import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { InputGroup, InputLabel, Select } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";

export const getCompatibleAlgorithms = libraryType => {
    if (libraryType === "amplicon") {
        return ["aodp"];
    }

    return ["pathoscope_bowtie", "nuvs"];
};

/**
 * An input-based component for selecting an algorithm (eg. pathoscope_bowtie), by its display name
 * (eg. Pathoscope Bowtie).
 *
 */
export const AlgorithmSelect = ({ hasHmm, libraryType, value, onChange }) => {
    const optionComponents = map(getCompatibleAlgorithms(libraryType), algorithm => (
        <option key={algorithm} value={algorithm} disabled={algorithm === "nuvs" && !hasHmm}>
            {getTaskDisplayName(algorithm)}
        </option>
    ));

    return (
        <InputGroup>
            <InputLabel>Algorithm</InputLabel>
            <Select name="algorithm" value={value} onChange={onChange}>
                {optionComponents}
            </Select>
        </InputGroup>
    );
};

AlgorithmSelect.propTypes = {
    libraryType: PropTypes.string.isRequired,
    value: PropTypes.oneOf(["pathoscope_bowtie", "nuvs", "aodp"]),
    onChange: PropTypes.func,
    hasHmm: PropTypes.bool
};
