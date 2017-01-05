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
import { Icon } from "./";

/**
 * A component that displays a icon-based radio button. The fill of the radio button depends on the "checked" prop.
 */
export const Radio = (props) => (
    // Set the icon class to "i-radio-checked" if checked is true, otherwise set it to "i-radio-unchecked"
    <Icon onClick={props.onClick} name={"radio-" + (props.checked ? "checked": "unchecked")} />
);

Radio.propTypes = {
    checked: React.PropTypes.bool.isRequired,
    onClick: React.PropTypes.func
};
