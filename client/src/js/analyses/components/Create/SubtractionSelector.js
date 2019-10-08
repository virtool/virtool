import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { map } from "lodash-es";

import { Input } from "./";

export const algorithms = ["pathoscope_bowtie", "nuvs"];

/**
 * An input-based component for selecting an algorithm (eg. pathoscope_bowtie), by its display name
 * (eg. Pathoscope Bowtie).
 *
 */
export const SubtractionSelector = props => (
    <Input name="subtraction" type="select" label="Subtraction" value={props.value} onChange={props.onChange}>
        {map(algorithms, algorithm => (
            <option key={subtraction} value={subtraction}>
                {subtraction}
            </option>
        ))}
    </Input>
);

SubtractionSelector.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func
};
