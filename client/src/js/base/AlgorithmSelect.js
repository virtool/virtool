import React from "react";
import PropTypes from "prop-types";

import { Input } from "./";
import { getTaskDisplayName } from "../utils";


const algorithms = [
    "pathoscope_bowtie",
    "nuvs"
];

export const AlgorithmSelect = (props) => (
    <Input
        name="algorithm"
        type="select"
        label={props.noLabel ? null : "Algorithm"}
        value={props.value}
        onChange={props.onChange}
    >
        {algorithms.map(
            algorithm => <option key={algorithm} value={algorithm}>{getTaskDisplayName(algorithm)}</option>
        )}
    </Input>
);

AlgorithmSelect.propTypes = {
    noLabel: PropTypes.bool,
    value: PropTypes.oneOf(["pathoscope_bowtie", "nuvs"]),
    onChange: PropTypes.func
};

