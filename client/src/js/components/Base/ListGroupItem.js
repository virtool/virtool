/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ListGroupItem
 */

import React from "react";
import { pick } from "lodash";
import { ListGroupItem as BsListGroupItem } from "react-bootstrap";

/**
 * An extension of the React-Bootstrap ListGroupItem component, except it doesn't gain focus when clicked.
 */
export class ListGroupItem extends React.Component {

    static propTypes = {
        allowFocus: React.PropTypes.bool,
        children: React.PropTypes.oneOf([
            React.PropTypes.element,
            React.PropTypes.arrayOf(React.PropTypes.element)
        ])
    };

    static defaultProps = {
        allowFocus: false
    };

    /**
     * A callback the blurs focus on the target element associated with the passed onFocus event.
     *
     * @param event {object} - the onFocus event object that triggered the callback.
     */
    handleFocus = (event) => {
        event.target.blur();
    };

    render () {

        const props = pick(this.props, [
            "active",
            "style",
            "className",
            "bsStyle",
            "disabled",
            "header",
            "href",
            "onClick",
            "type"
        ]);

        return (
            <BsListGroupItem {...props} onFocus={this.props.allowFocus ? null: this.handleFocus}>
                {this.props.children}
            </BsListGroupItem>
        );
    }
}
