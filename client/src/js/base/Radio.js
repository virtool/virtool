import React from "react";
import PropTypes from "prop-types";
import { Flex, FlexItem, Icon } from "./index";

/**
 * A pretty radio button based on font icons.
 *
 * @param checked {boolean} is the button active
 * @param label {string} a label to place to the right of the button
 * @param onClick {function} a function to call when the button is clicked
 */
export const Radio = ({ checked, label, onClick }) => (
    <Flex alignItems="center" style={{ marginBottom: "3px" }}>
        <Icon onClick={onClick} name={checked ? "dot-circle" : "circle"} />
        <FlexItem pad={5}>{label ? <span> {label}</span> : null}</FlexItem>
    </Flex>
);

Radio.propTypes = {
    checked: PropTypes.bool.isRequired,
    label: PropTypes.string,
    onClick: PropTypes.func
};
