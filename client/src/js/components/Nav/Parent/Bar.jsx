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
            showChangePassword: false,
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

    /**
     * Toggles the 'changePassword' state. Called when the user menu password button is clicked or the ChangePassword
     * modal is closed (onHide function).
     *
     * @func
     */
    toggleChangePassword: function () {
        this.setState({showChangePassword: !this.state.showChangePassword});
    },

    /**
     * Toggles the 'changePassword' state. Called when the user menu password button is clicked or the ChangePassword
     * modal is closed (onHide function).
     *
     * @func
     */
    toggleUserSettings: function () {
        this.setState({showUserSettings: !this.state.showUserSettings});
    },

    handleDropdownSelect: function (event, eventKey) {
        switch (eventKey) {
            case 1:
                this.toggleChangePassword();
                break;

            case 2:
                this.toggleUserSettings();
                break;

            case 3:
                dispatcher.user.logout();
                break;
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
                    <MenuItem eventKey={1}>
                        <Icon name='lock' /> Password
                    </MenuItem>
                    <MenuItem eventKey={2}>
                        <Icon name='settings' /> Settings
                    </MenuItem>
                    <MenuItem  eventKey={3}>
                        <Icon name='exit' /> Logout
                    </MenuItem>
                </NavDropdown>
            );
        }

        var userSettings;

        if (dispatcher.user.name) {
            userSettings = (
                <UserSettings
                    {...this.props}
                    user={dispatcher.user}
                    show={this.state.showUserSettings}
                    onHide={this.toggleUserSettings}
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
                    show={this.state.showChangePassword}
                    onHide={this.toggleChangePassword}
                />

                {userSettings}

            </Navbar>
        );
    }
});

module.exports = ParentBar;