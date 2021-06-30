import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../../../base/MultiSelector";

export const MultiSubtractionSelector = ({ subtractions, selected, onChange }) => {
    const subtractionComponents = map(subtractions, ({ name, id }) => (
        <MultiSelectorItem key={id} name={name} value={id} id={id}>
            <span>{name}</span>
        </MultiSelectorItem>
    ));

    return (
        <MultiSelector name="subtraction" noun="Subtractions" selected={selected} onChange={onChange}>
            {subtractionComponents}
        </MultiSelector>
    );
};

MultiSubtractionSelector.propTypes = {
    subtractions: PropTypes.arrayOf(PropTypes.object),
    selected: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
