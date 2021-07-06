import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../../base/MultiSelector";

export const MultiSubtractionSelector = ({ name, noun, selected, subtractions, onChange }) => {
    const subtractionComponents = map(subtractions, ({ name, id }) => (
        <MultiSelectorItem key={id} name={name} value={id} id={id}>
            <span>{name}</span>
        </MultiSelectorItem>
    ));

    return (
        <MultiSelector name={name} noun={noun} selected={selected} onChange={onChange}>
            {subtractionComponents}
        </MultiSelector>
    );
};

MultiSubtractionSelector.propTypes = {
    name: PropTypes.string.isRequired,
    noun: PropTypes.string.isRequired,
    subtractions: PropTypes.arrayOf(PropTypes.object),
    selected: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
