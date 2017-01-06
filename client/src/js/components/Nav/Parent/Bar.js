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

import React from "react";
import ParentButton from "./Button";
import { Nav, Navbar, NavDropdown, MenuItem } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import ChangePassword from "../ChangePassword";
import UserSettings from "../UserSettings";

/**
 * The primary navbar component.
 */
export default class ParentBar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            activeParent: dispatcher.router.route.parent,
            modalMode: null,
            showUserSettings: false
        };
    }

    componentDidMount () {
        dispatcher.router.on("change", this.onRouteChange);
    }

    componentWillUnmount () {
        dispatcher.router.off("change", this.onRouteChange);
    }

    onRouteChange = (route) => {
        this.setState({
            activeParent: route.parent
        });
    };

    hideModal = () => {
        this.setState({modalMode: null});
    };

    handleDropdownSelect = (eventKey) => {
        if (eventKey === "password" || eventKey === "settings") {
            this.setState({
                modalMode: eventKey
            });
        }

        if (eventKey === "logout") {
            dispatcher.user.logout();
        }
    };

    render () {

        // Generate a primary navItem for each primary route (home, jobs, samples, viruses, hosts, options). Only show
        // the options navItem if the user is an administrator.
        const navItemComponents = dispatcher.router.structure.map((parent) => {
            if (parent.key !== "options" || dispatcher.user.permissions.modify_options) {
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
        });

        let dropDown;

        // If the user has logged in, show the user menu dropdown.
        if (dispatcher.user.name) {
            // The title component for the user drop down menu.
            const userTitle = (
                <span>
                    <Icon name="user" /> {dispatcher.user.name}
                </span>
            );

            dropDown = (
                <NavDropdown title={userTitle} onSelect={this.handleDropdownSelect} id="user-dropdown">
                    <MenuItem eventKey="password">
                        <Icon name="lock" /> Password
                    </MenuItem>
                    <MenuItem eventKey="settings">
                        <Icon name="cog" /> Settings
                    </MenuItem>
                    <MenuItem  eventKey="logout">
                        <Icon name="exit" /> Logout
                    </MenuItem>
                </NavDropdown>
            );
        }

        let userSettings;

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
                        <Icon name="vtlogo" className="vtlogo" />
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
}
