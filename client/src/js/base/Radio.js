/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Radio
 */

import React from "react";
import PropTypes from "prop-types";
import { Flex, FlexItem, Icon } from "./";

/**
 * A component that displays a icon-based radio button. The fill of the radio button depends on the "checked" prop.
 */
export const Radio = ({ checked, label, onClick }) => {
    // Set the icon class to "i-radio-checked" if checked is true, otherwise set it to "i-radio-unchecked"
    return (
        <Flex alignItems="center" style={{marginBottom: "3px"}}>
            <Icon onClick={onClick} name={`radio-${checked ? "checked" : "unchecked"}`} />
            <FlexItem pad={5}>
                {label ? <span> {label}</span>: null}
            </FlexItem>
        </Flex>
    );
};

Radio.propTypes = {
    checked: PropTypes.bool.isRequired,
    label: PropTypes.string,
    onClick: PropTypes.func
};
