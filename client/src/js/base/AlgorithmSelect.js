import React from "react";
import PropTypes from "prop-types";
import { map } from "lodash-es";

import { getTaskDisplayName } from "../utils";
import { Input } from "./";

export const algorithms = ["pathoscope_bowtie", "nuvs"];

/**
 * An input-based component for selecting an algorithm (eg. pathoscope_bowtie), by its display name
 * (eg. Pathoscope Bowtie).
 *
 */
export const AlgorithmSelect = props => (
    <Input
        name="algorithm"
        type="select"
        label={props.noLabel ? null : "Algorithm"}
        value={props.value}
        onChange={props.onChange}
    >
        {map(algorithms, algorithm => (
            <option key={algorithm} value={algorithm} disabled={algorithm === "nuvs" && !props.hasHmm}>
                {getTaskDisplayName(algorithm)}
            </option>
        ))}
    </Input>
);

AlgorithmSelect.propTypes = {
    noLabel: PropTypes.bool,
    value: PropTypes.oneOf(["pathoscope_bowtie", "nuvs"]),
    onChange: PropTypes.func,
    hasHmm: PropTypes.bool
};
