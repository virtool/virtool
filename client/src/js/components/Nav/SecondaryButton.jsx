/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SecondaryButton
 */

'use strict';

var CX = require('classnames');
var React = require('react');

/**
 * The button for a secondary navbar which renders a single child route of a primary route.
 */
var SecondaryButton = React.createClass({
    /**
     * Change the secondary route in the router in response to a click event on the button.
     * @func
     */
    handleClick: function () {
        this.props.router.secondary(this.props.label);
    },

    render: function () {

        var itemClasses = CX({
            pointer: true,
            active: this.props.active
        });

        return (
            <li className={itemClasses} onClick={this.handleClick}>
                <a>{_.capitalize(this.props.label)}</a>
            </li>
        )
    }
});

module.exports = SecondaryButton;