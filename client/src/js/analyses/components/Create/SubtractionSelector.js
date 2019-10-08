import React from "react";
import PropTypes from "prop-types";
import { map } from "lodash-es";
import { Input } from "../../../base";

export const SubtractionSelector = ({ subtractions, value, onChange }) => (
    <Input name="subtraction" type="select" label="Subtraction" value={value} onChange={onChange}>
        {map(subtractions, subtractionId => (
            <option key={subtractionId} value={subtractionId}>
                {subtractionId}
            </option>
        ))}
    </Input>
);

SubtractionSelector.propTypes = {
    subtractions: PropTypes.arrayOf(PropTypes.string),
    value: PropTypes.string,
    onChange: PropTypes.func
};
