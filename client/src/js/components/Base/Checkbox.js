/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Checkbox
 */

import React from "react";

/**
 * A checkbox component based on the Icomoon checkbox icons. Has three possible states: checked, unchecked, and partial.
 * The checkedness is set with two props: checked and partial. Takes an onClick prop which is a function to call when
 * the checkbox is clicked.
 *
 * @class
 *
 */
export default class Checkbox extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        checked: React.PropTypes.bool,
        partial: React.PropTypes.bool,
        onClick: React.PropTypes.func,
        pending: React.PropTypes.bool,
        pullRight: React.PropTypes.bool
    };

    static defaultProps = {
        checked: false,
        partial: false,
        pullRight: false
    };

    render () {

        let name = "unchecked";

        if (this.props.checked) {
            name = "checked";
        } else {
            if (this.props.partial) name = "partial";
        }

        return (
            <span className={this.props.pullRight ? "pull-right": null} onClick={this.props.onClick}>
                <i className={"pointer i-checkbox-" + name} />
            </span>
        );
    }

}
