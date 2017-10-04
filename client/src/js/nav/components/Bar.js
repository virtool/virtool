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
import { assign, startsWith } from "lodash";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem } from "react-bootstrap";

import { logout } from "../../account/actions";
import { Icon, AutoProgressBar } from "../../base"

const isHomeActive = (match, location) => {
    return location.pathname === "/" || startsWith(location.pathname, "/home")
};

/**
 * A container component that renders the primary and secondary navigation bars.
 */
const Bar = (props) => {

    const dropdownTitle = (
        <span>
            <Icon name="user" /> {props.id}
        </span>
    );

    return (
        <div className="vt-header">
            <Navbar fixedTop>
                <Navbar.Header>
                    <Navbar.Brand>
                        <Icon name="vtlogo" className="vtlogo"/>
                    </Navbar.Brand>

                    <Navbar.Toggle />
                </Navbar.Header>

                <Navbar.Collapse>
                    <Nav>
                        <LinkContainer to="/home" isActive={isHomeActive}>
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

                    <Nav pullRight>
                        <NavItem target="_blank" href="https://github.com/virtool/virtool" rel="noopener noreferrer">
                            <Icon name="github" />
                        </NavItem>

                        <NavItem target="_blank" href="https://docs.virtool.ca" rel="noopener noreferrer">
                            <Icon name="book" />
                        </NavItem>

                        <NavDropdown id="account-dropdown" title={dropdownTitle}>
                            <MenuItem>Settings</MenuItem>
                            <MenuItem onClick={props.logout}>Logout</MenuItem>
                        </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>

            <AutoProgressBar step={50} interval={80} active={props.pending} affixed />
        </div>
    );
};

const mapStateToProps = (state) => {
    return assign({}, state.account, {pending: state.app.pending});
};

const mapDispatchToProps = (dispatch) => {
    return {
        logout: () => {
            dispatch(logout())
        }
    };
};

const BarContainer = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(Bar));

export default BarContainer;
