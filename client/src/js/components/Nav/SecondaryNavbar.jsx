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

var SecondaryButton = require('./SecondaryButton.jsx');

/**
 * The secondary navbar which display child routes of the active primary route.
 */
var SecondaryNavbar = React.createClass({

    getInitialState: function () {
        return {documents: this.props.router.children('home')};
    },

    componentDidMount: function () {
        this.props.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        this.props.router.off('change', this.onRouteChange);
    },

    /**
     * Changes the child route documents when the route changes. Called in respone to a change event in the router.
     *
     * @param route
     * @func
     */
    onRouteChange: function (route) {
        route = route.split('/')[0];
        var documents = this.props.router.children(route);
        this.setState({documents: documents});
    },

    render: function () {
        // Each button component shows up in the secondary navbar.
        var buttonComponents = this.state.documents.map(function (document) {
            return <SecondaryButton key={document.label} router={this.props.router} {...document} />;
        }, this);

        return (
            <ol className='subnav'>
                {buttonComponents}
            </ol>
        );
    }
});

module.exports = SecondaryNavbar;