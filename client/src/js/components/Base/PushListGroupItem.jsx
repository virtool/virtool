/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PushListGroupItem
 */

'use strict';

import React from "react";
import { pick } from "lodash";
import { ListGroupItem } from "react-bootstrap";

/**
 * An extension of the React-Bootstrap ListGroupItem component, except it doesn't gain focus when clicked.
 */
var PushListGroupItem = React.createClass({

    propTypes: {
        allowFocus: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            allowFocus: false
        };
    },

    /**
     * A callback the blurs focus on the target element associated with the passed onFocus event.
     *
     * @param event {object} - the onFocus event object that triggered the callback.
     */
    handleFocus: function (event) {
        event.target.blur();
    },

    render: function () {

        var props = pick(this.props, [
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
            <ListGroupItem {...props} onFocus={this.props.allowFocus ? null: this.handleFocus}>
                {this.props.children}
            </ListGroupItem>
        );
    }

});

module.exports = PushListGroupItem;