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
import PropTypes from "prop-types";
import { pick } from "lodash";
import { ListGroupItem as BsListGroupItem } from "react-bootstrap";

/**
 * An extension of the React-Bootstrap ListGroupItem component, except it doesn't gain focus when clicked.
 */
export class ListGroupItem extends React.Component {

    static propTypes = {
        allowFocus: PropTypes.bool,
        children: PropTypes.node.isRequired
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
