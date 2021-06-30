import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { InputGroup, InputLabel } from "../../../base";
import { MultiSelector, MultiSelectorItem } from "../../../base/MultiSelector";

export const SubtractionSelector = ({ subtractions, value, onChange }) => {
    const optionComponents = map(subtractions, ({ name, id }) => (
        <MultiSelectorItem key={id} name={name} value={id} id={id}>
            <span>{name}</span>
        </MultiSelectorItem>
    ));

    return (
        <InputGroup>
            <InputLabel>Subtraction</InputLabel>
            <MultiSelector name="subtraction" noun="Subtractions" selected={value} onChange={onChange}>
                {optionComponents}
            </MultiSelector>
        </InputGroup>
    );
};

SubtractionSelector.propTypes = {
    subtractions: PropTypes.arrayOf(PropTypes.object),
    value: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
