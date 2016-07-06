/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SecondaryNavbar
 */

'use strict';

var React = require('react');
var Nav = require('react-bootstrap/lib/Nav');
var Navbar = require('react-bootstrap/lib/Navbar');
var NavItem = require('react-bootstrap/lib/NavItem');

var ChildButton = require('./Button.jsx');

/**
 * The secondary navbar which display child routes of the active primary route.
 */
var ChildBar = React.createClass({

    getInitialState: function () {
        return {
            activeChild: dispatcher.router.route.child,
            children: dispatcher.router.route.children
        };
    },

    componentDidMount: function () {
        dispatcher.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        dispatcher.router.off('change', this.onRouteChange);
    },

    /**
     * Changes the child route documents when the route changes. Called in response to a change event in the router.
     *
     * @param route
     * @func
     */
    onRouteChange: function (route) {
        

        this.setState({
            activeChild: route.child,
            children: route.children
        });
    },

    render: function () {

        // Each button component shows up in the secondary navbar.
        var buttonComponents = this.state.children.map(function (child) {
            return (
                <ChildButton
                    {...child}
                    childKey={child.key}
                    active={child.key === this.state.activeChild}
                />
            );
        }, this);

        return (
            <ol className='subnav'>
                {buttonComponents}
            </ol>
        );
    }
});

module.exports = ChildBar;