import React from "react";
import PropTypes from "prop-types";
import { Flex, FlexItem, Icon } from "./index";

export const Radio = ({ checked, label, onClick }) => (
    <Flex alignItems="center" style={{marginBottom: "3px"}}>
        <Icon onClick={onClick} name={`radio-${checked ? "checked" : "unchecked"}`} />
        <FlexItem pad={5}>
            {label ? <span> {label}</span> : null}
        </FlexItem>
    </Flex>
);

Radio.propTypes = {
    checked: PropTypes.bool.isRequired,
    label: PropTypes.string,
    onClick: PropTypes.func
};
