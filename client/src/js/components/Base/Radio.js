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
export default class Radio extends React.Component {

    static propTypes = {
        checked: React.PropTypes.bool.isRequired,
        onClick: React.PropTypes.func
    };

    defaultProps = {
        onClick: () => {}
    };

    render () {
        // Set the icon class to "i-radio-checked" if checked is true, otherwise set it to "i-radio-unchecked"
        return <Icon onClick={this.props.onClick} name={"radio-" + (this.props.checked ? "checked": "unchecked")} />;
    }

}