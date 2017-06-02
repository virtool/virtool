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
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem } from "react-bootstrap";

import { logout } from "../actions";
import { Icon } from "virtool/js/components/Base"

/**
 * A container component that renders the primary and secondary navigation bars.
 */
const Bar = (props) => {

    const dropdownTitle = (
        <span><Icon name="user" /> {props.user_id}</span>
    );

    return (
        <Navbar fixedTop>
            <Navbar.Header>
                <Navbar.Brand>
                    <Icon name="vtlogo" className="vtlogo"/>
                </Navbar.Brand>

                <Navbar.Toggle />
            </Navbar.Header>

            <Navbar.Collapse>

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

                <Nav pullRight>
                    <NavDropdown id="account-dropdown" title={dropdownTitle}>
                        <MenuItem>Settings</MenuItem>
                        <MenuItem onClick={props.logout}>Logout</MenuItem>
                    </NavDropdown>
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    );
};

Bar.propTypes = {
    user_id: React.PropTypes.string,
    logout: React.PropTypes.func
};

const mapStateToProps = (state) => {
    return state.account;
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
