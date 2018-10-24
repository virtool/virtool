import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";

/**
 * Application icon font.
 *
 * @param checked
 * @param partial
 * @returns {*}
 * @constructor
 */
export const CheckboxIcon = ({ checked }) => (
  <i className={`far fa-lg fa-${checked ? "check-square" : "square"}`} />
);

/**
 * A simple checkbox component based on the application icon font.
 *
 * @param props
 * @returns {*} any type
 * @constructor
 */
export const Checkbox = props => {
  let className = CX("pointer", {
    "pull-right": props.pullRight,
    "labelled-checkbox": props.label,
    "text-muted": props.disabled
  });

  if (props.className) {
    className += ` ${props.className}`;
  }

  let style = { cursor: props.disabled ? "not-allowed" : "pointer" };

  if (props.style) {
    style = { ...style, ...props.style };
  }

  return (
    <span
      className={className}
      onClick={props.disabled ? null : props.onClick}
      style={style}
    >
      <CheckboxIcon {...props} />{" "}
      {props.label ? <span>{props.label}</span> : null}
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
  pullRight: PropTypes.bool,
  style: PropTypes.object
};

Checkbox.defaultProps = {
  checked: false,
  partial: false,
  pullRight: false
};
