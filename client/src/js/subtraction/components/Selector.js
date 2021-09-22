import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../../base/MultiSelector";
import { Icon } from "../../base";
import { Link } from "react-router-dom";

export const SampleSubtractionSelector = ({ name, noun, selected, subtractions, onChange }) => {
    let subtractionComponents = map(subtractions, ({ name, id }) => (
        <MultiSelectorItem key={id} name={name} value={id} id={id}>
            <span>{name}</span>
        </MultiSelectorItem>
    ));

    if (!subtractions.length) {
        subtractionComponents = (
            <MultiSelectorItem disabled={true}>
                <span>{"N/A"}</span>
            </MultiSelectorItem>
        );
    }

    return (
        <div>
            <MultiSelector name={name} noun={noun} selected={selected} onChange={onChange}>
                {subtractionComponents}
            </MultiSelector>
            {!subtractions.length && (
                <div>
                    <Icon name="info-circle" /> No Subtractions Found.
                    <Link to="/subtraction"> Create some</Link>
                </div>
            )}
        </div>
    );
};

SampleSubtractionSelector.propTypes = {
    name: PropTypes.string.isRequired,
    noun: PropTypes.string.isRequired,
    subtractions: PropTypes.arrayOf(PropTypes.object),
    selected: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
