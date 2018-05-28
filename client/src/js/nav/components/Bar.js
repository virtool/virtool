import React from "react";
import { startsWith } from "lodash-es";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem } from "react-bootstrap";

import Update from "./Update";
import { logout } from "../../account/actions";
import { Icon, AutoProgressBar, VTLogo } from "../../base";

const isHomeActive = (match, location) => location.pathname === "/" || startsWith(location.pathname, "/home");

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
                        <VTLogo />
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

                        <LinkContainer to="/refs">
                            <NavItem>
                                References
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to="/hmm">
                            <NavItem>
                                HMM
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to="/subtraction">
                            <NavItem>
                                Subtraction
                            </NavItem>
                        </LinkContainer>
                    </Nav>

                    <Nav pullRight>
                        <Update />

                        <NavItem
                            target="_blank"
                            href="https://github.com/virtool/virtool"
                            rel="noopener noreferrer"
                        >
                            <Icon name="github" faStyle="fab" />
                        </NavItem>

                        <NavItem target="_blank" href="https://www.virtool.ca/docs/manual" rel="noopener noreferrer">
                            <Icon name="book" />
                        </NavItem>

                        <NavDropdown id="account-dropdown" title={dropdownTitle}>
                            <LinkContainer to="/account" activeClassName="">
                                <MenuItem>Account</MenuItem>
                            </LinkContainer>
                            <LinkContainer to="/administration">
                                <MenuItem>Administration</MenuItem>
                            </LinkContainer>
                            <MenuItem href="https://gitreports.com/issue/virtool/virtool" target="_blank">
                                Report Issue
                            </MenuItem>
                            <MenuItem onClick={props.logout}>Logout</MenuItem>
                        </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>

            <AutoProgressBar step={50} interval={80} active={props.pending} affixed />
        </div>
    );
};

const mapStateToProps = (state) => ({
    ...state.account,
    pending: state.app.pending
});

const mapDispatchToProps = (dispatch) => ({

    logout: () => {
        dispatch(logout());
    }
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Bar));
