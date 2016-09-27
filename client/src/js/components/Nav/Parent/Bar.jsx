/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ParentBar
 */

'use strict';

var React = require('react');

var Nav = require('react-bootstrap/lib/Nav');
var Navbar = require('react-bootstrap/lib/Navbar');
var NavDropdown = require('react-bootstrap/lib/NavDropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var ParentButton = require('./Button.jsx');
var ChangePassword = require('../ChangePassword.jsx');
var UserSettings = require('../UserSettings.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * The primary navbar component.
 */
var ParentBar = React.createClass({

    getInitialState: function () {
        return {
            activeParent: dispatcher.router.route.parent,
            modalMode: null,
            showUserSettings: false
        };
    },

    componentDidMount: function () {
        dispatcher.router.on('change', this.onRouteChange);
    },

    componentWillUnmount: function () {
        dispatcher.router.off('change', this.onRouteChange);
    },

    onRouteChange: function (route) {
        this.setState({
            activeParent: route.parent
        });
    },

    hideModal: function () {
        this.setState({modalMode: null});
    },

    handleDropdownSelect: function (eventKey) {
        if (eventKey === "password" || eventKey === "settings") {
            this.setState({
                modalMode: eventKey
            });
        }

        if (eventKey === "logout") {
            dispatcher.user.logout();
        }
    },

    render: function () {

        // Generate a primary navItem for each primary route (home, jobs, samples, viruses, hosts, options). Only show
        // the options navItem if the user is an administrator.
        var navItemComponents = dispatcher.router.structure.map(function (parent) {
            if (parent.key !== 'options' || dispatcher.user.permissions.modify_options) {
                return (
                    <ParentButton
                        key={parent.key}
                        parentKey={parent.key}
                        label={parent.label}
                        iconName={parent.icon}
                        active={parent.key === this.state.activeParent}
                    />
                );
            }
        }, this);

        var dropDown;

        // If the user has logged in, show the user menu dropdown.
        if (dispatcher.user.name) {

            // The title component for the user drop down menu.
            var userTitle = (
                <span>
                    <Icon name='user' /> {dispatcher.user.name}
                </span>
            );

            dropDown = (
                <NavDropdown title={userTitle} onSelect={this.handleDropdownSelect} id='user-dropdown'>
                    <MenuItem eventKey="password">
                        <Icon name='lock' /> Password
                    </MenuItem>
                    <MenuItem eventKey="settings">
                        <Icon name='settings' /> Settings
                    </MenuItem>
                    <MenuItem  eventKey="logout">
                        <Icon name='exit' /> Logout
                    </MenuItem>
                </NavDropdown>
            );
        }

        var userSettings;

        if (dispatcher.user.name) {
            userSettings = (
                <UserSettings
                    user={dispatcher.user}
                    show={this.state.modalMode === "settings"}
                    onHide={this.hideModal}
                />
            );
        }

        return (
            <Navbar fixedTop fluid>

                <Navbar.Header>
                    <Navbar.Brand>
                        <Icon name='vtlogo' className='vtlogo' />
                    </Navbar.Brand>
                </Navbar.Header>

                <Navbar.Collapse>
                    <Nav>
                        {navItemComponents}
                    </Nav>
                    <Nav pullRight>
                        {dropDown}
                    </Nav>
                </Navbar.Collapse>

                <ChangePassword
                    {...this.props}
                    user={dispatcher.user}
                    show={this.state.modalMode === "password"}
                    onHide={this.hideModal}
                />

                {userSettings}

            </Navbar>
        );
    }
});

module.exports = ParentBar;