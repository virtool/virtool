import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";

export const Checkbox = (props) => {

    let name;

    if (props.checked) {
        name = "checked";
    } else if (props.partial) {
        name = "partial";
    } else {
        name = "unchecked";
    }

    let className = CX("pointer", {
        "pull-right": props.pullRight,
        "labelled-checkbox": props.label
    });

    if (props.className) {
        className += ` ${props.className}`;
    }

    return (
        <span className={className} onClick={props.onClick} style={props.style}>
            <i className={`i-checkbox-${name}`} /> {props.label ? <span>{props.label}</span> : null}
        </span>
    );
};

Checkbox.propTypes = {
    label: PropTypes.node,
    checked: PropTypes.bool,
    partial: PropTypes.bool,
    onClick: PropTypes.func,
    pending: PropTypes.bool,
    style: PropTypes.object,
    className: PropTypes.string,
    pullRight: PropTypes.bool
};

Checkbox.defaultProps = {
    checked: false,
    partial: false,
    pullRight: false
};
