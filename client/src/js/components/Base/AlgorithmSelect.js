import React from "react";
import { Input } from "./";
import { getTaskDisplayName } from "virtool/js/utils";

export const algorithms = ["pathoscope_bowtie", "pathoscope_snap", "nuvs"];

export const AlgorithmSelect = (props) => (
    <Input
        name="algorithm"
        type="select"
        label={props.noLabel ? null: "Algorithm"}
        value={props.value}
        onChange={props.onChange}
    >
        {algorithms.map(
            algorithm => <option key={algorithm} value={algorithm}>{getTaskDisplayName(algorithm)}</option>
        )}
    </Input>
);

AlgorithmSelect.propTypes = {
    noLabel: React.PropTypes.bool,
    value: React.PropTypes.oneOf(["pathoscope_bowtie", "pathoscope_snap", "nuvs"]),
    onChange: React.PropTypes.func
};

