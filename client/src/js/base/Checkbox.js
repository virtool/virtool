import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";

const CheckboxIcon = ({ checked, partial }) => {

    let name;

    if (checked) {
        name = "checked";
    } else if (partial) {
        name = "partial";
    } else {
        name = "unchecked";
    }

    return <i className={`i-checkbox-${name}`} />;
};


/**
 * A simple checkbox component based on the application icon font.
 *
 * @param props
 * @returns {*}
 * @constructor
 */
export const Checkbox = (props) => {

    let className = CX("pointer", {
        "pull-right": props.pullRight,
        "labelled-checkbox": props.label,
        "text-muted": props.disabled
    });

    if (props.className) {
        className += ` ${props.className}`;
    }

    let style = {cursor: props.disabled ? "not-allowed" : "pointer"};

    if (props.style) {
        style = {...style, ...props.style};
    }

    return (
        <span className={className} onClick={props.disabled ? null : props.onClick} style={style}>
            <CheckboxIcon {...props} /> {props.label ? <span>{props.label}</span> : null}
        </span>
    );
};

Checkbox.propTypes = {
    checked: PropTypes.bool,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    label: PropTypes.node,
    onClick: PropTypes.func,
    partial: PropTypes.bool,
    pending: PropTypes.bool,
    pullRight: PropTypes.bool,
    style: PropTypes.object
};

Checkbox.defaultProps = {
    checked: false,
    partial: false,
    pullRight: false
};
