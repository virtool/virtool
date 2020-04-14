import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { InputGroup, InputLabel, Select } from "../../../base";

export const SubtractionSelector = ({ subtractions, value, onChange }) => {
    const optionComponents = map(subtractions, subtraction => (
        <option key={subtraction.id} value={subtraction.id}>
            {subtraction.name}
        </option>
    ));

    return (
        <InputGroup>
            <InputLabel>Subtraction</InputLabel>
            <Select name="subtraction" value={value} onChange={onChange}>
                {optionComponents}
            </Select>
        </InputGroup>
    );
};

SubtractionSelector.propTypes = {
    subtractions: PropTypes.arrayOf(PropTypes.object),
    value: PropTypes.string,
    onChange: PropTypes.func
};
