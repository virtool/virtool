/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Bar
 */

import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base"

/**
 * A container component that renders the primary and secondary navigation bars.
 */
const Bar = () => (
    <Navbar>
        <Navbar.Header>
            <Navbar.Brand>
                <Icon name="vt-logo" />
            </Navbar.Brand>
        </Navbar.Header>

        <Nav>
            <LinkContainer to="/">
                <NavItem>
                    Home
                </NavItem>
            </LinkContainer>

            <LinkContainer to="/jobs">
                <NavItem>
                    Jobs
                </NavItem>
            </LinkContainer>

            <LinkContainer to="/samples">
                <NavItem>
                    Samples
                </NavItem>
            </LinkContainer>

            <LinkContainer to="/viruses">
                <NavItem>
                    Viruses
                </NavItem>
            </LinkContainer>

            <LinkContainer to="/subtraction">
                <NavItem>
                    Subtraction
                </NavItem>
            </LinkContainer>

            <LinkContainer to="/settings">
                <NavItem>
                    Settings
                </NavItem>
            </LinkContainer>
        </Nav>
    </Navbar>
);

export default Bar;
