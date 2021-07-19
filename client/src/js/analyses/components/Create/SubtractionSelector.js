import PropTypes from "prop-types";
import React from "react";
import { InputGroup, InputLabel } from "../../../base";
import { SampleSubtractionSelector } from "../../../subtraction/components/Selector";

export const SubtractionSelector = ({ subtractions, value, onChange }) => {
    return (
        <InputGroup>
            <InputLabel>Subtraction</InputLabel>
            <SampleSubtractionSelector
                name="Subtraction"
                noun="Subtractions"
                subtractions={subtractions}
                selected={value}
                onChange={onChange}
            />
        </InputGroup>
    );
};

SubtractionSelector.propTypes = {
    subtractions: PropTypes.arrayOf(PropTypes.object),
    value: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
