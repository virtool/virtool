/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PrimaryButton
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var NavItem = require('react-bootstrap/lib/NavItem');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component that renders to a primary link in the primary navbar.
 */
var PrimaryButton = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return nextProps.active !== this.props.active;
    },

    /**
     * Callback triggered by clicking on the primary button. Changes the primary route in the router to that
     * associated with the button.
     *
     * @param event {object} - the click event.
     */
    handleClick: function (event) {
        event.preventDefault();
        dispatcher.router.setParent(this.props.parentKey);
    },

    render: function () {
        return (
            <NavItem onClick={this.handleClick} className='pointer' active={this.props.active}>
                <Flex>
                    <Flex.Item>
                        <Icon name={this.props.iconName} />
                    </Flex.Item>
                    <Flex.Item pad={5}>
                        {this.props.label || _.capitalize(this.props.parentKey)}
                    </Flex.Item>
                </Flex>
            </NavItem>
        );
    }
});

module.exports = PrimaryButton;