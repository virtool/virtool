import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { MultiSelector, MultiSelectorItem } from "../../base/MultiSelector";
import { Link, BrowserRouter } from "react-router-dom";
import { Box, Icon } from "../../base";

export const SampleSubtractionSelector = ({ name, noun, selected, subtractions, onChange }) => {
    const subtractionComponents = map(subtractions, ({ name, id }) => (
        <MultiSelectorItem key={id} name={name} value={id} id={id}>
            <span>{name}</span>
        </MultiSelectorItem>
    ));
    if (!subtractions.length) {
        return (
            <div>
                <Box>
                    <Icon name="info-circle" /> <span> No Subtractions Found. </span>
                    <BrowserRouter>
                        <Link to="/subtraction"> Create one</Link>.
                    </BrowserRouter>
                </Box>
            </div>
        );
    }
    return (
        <MultiSelector name={name} noun={noun} selected={selected} onChange={onChange}>
            {subtractionComponents}
        </MultiSelector>
    );
};

SampleSubtractionSelector.propTypes = {
    name: PropTypes.string.isRequired,
    noun: PropTypes.string.isRequired,
    subtractions: PropTypes.arrayOf(PropTypes.object),
    selected: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
};
