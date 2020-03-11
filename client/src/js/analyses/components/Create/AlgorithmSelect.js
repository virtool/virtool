import React from "react";
import PropTypes from "prop-types";
import { map } from "lodash-es";

import { getTaskDisplayName } from "../../../utils/utils";
import { Input } from "../../../base";

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
export const AlgorithmSelect = ({ hasHmm, libraryType, value, onChange }) => (
    <Input name="algorithm" type="select" label="Algorithm" value={value} onChange={onChange}>
        {map(getCompatibleAlgorithms(libraryType), algorithm => (
            <option key={algorithm} value={algorithm} disabled={algorithm === "nuvs" && !hasHmm}>
                {getTaskDisplayName(algorithm)}
            </option>
        ))}
    </Input>
);

AlgorithmSelect.propTypes = {
    libraryType: PropTypes.string.isRequired,
    value: PropTypes.oneOf(["pathoscope_bowtie", "nuvs", "aodp"]),
    onChange: PropTypes.func,
    hasHmm: PropTypes.bool
};
