/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ChildButton
 */

'use strict';

var _ = require('lodash');
var CX = require('classnames');
var React = require('react');

/**
 * The button for a secondary navbar which renders a single child route of a primary route.
 */
var ChildButton = React.createClass({
    /**
     * Change the secondary route in the router in response to a click event on the button.
     * @func
     */
    handleClick: function () {
        dispatcher.router.setChild(this.props.childKey);
    },

    render: function () {

        var itemClasses = CX({
            pointer: true,
            active: this.props.active
        });

        return (
            <li className={itemClasses} onClick={this.handleClick}>
                <a>{this.props.label || _.capitalize(this.props.childKey)}</a>
            </li>
        )
    }
});

module.exports = ChildButton;