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

var React = require('react');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

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
        }
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
        return (
            <ListGroupItem {...this.props} onFocus={this.props.allowFocus ? null: this.handleFocus}>
                {this.props.children}
            </ListGroupItem>
        );
    }

});

module.exports = PushListGroupItem;