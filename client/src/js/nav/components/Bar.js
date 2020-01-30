import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { MenuItem, Nav, Navbar, NavDropdown, NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { logout } from "../../account/actions";
import { AutoProgressBar, Icon, VTLogo } from "../../base";
import { isHomeActive } from "../utils";
import { getSoftwareUpdates } from "../../updates/actions";
import Update from "./Update";

const BarLogo = styled(VTLogo)`
    margin: -5px 30px 0;

    svg {
        margin-left: 3px;
    }
`;

class Bar extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        const dropdownTitle = (
            <span>
                <Icon name="user" /> {this.props.id}
            </span>
        );

        return (
            <div className="vt-header">
                <Navbar fixedTop>
                    <Navbar.Header>
                        <Navbar.Brand>
                            <BarLogo />
                        </Navbar.Brand>

                        <Navbar.Toggle />
                    </Navbar.Header>

                    <Navbar.Collapse>
                        <Nav>
                            <LinkContainer to="/home" isActive={isHomeActive}>
                                <NavItem>Home</NavItem>
                            </LinkContainer>

                            <LinkContainer to="/jobs">
                                <NavItem>Jobs</NavItem>
                            </LinkContainer>

                            <LinkContainer to="/samples">
                                <NavItem>Samples</NavItem>
                            </LinkContainer>

                            <LinkContainer to="/refs">
                                <NavItem>References</NavItem>
                            </LinkContainer>

                            <LinkContainer to="/hmm">
                                <NavItem>HMM</NavItem>
                            </LinkContainer>

                            <LinkContainer to="/subtraction">
                                <NavItem>Subtraction</NavItem>
                            </LinkContainer>
                        </Nav>

                        <Nav pullRight>
                            <Update />

                            <NavItem target="_blank" href="https://gitter.im/virtool/virtool" rel="noopener noreferrer">
                                <Icon name="comments" />
                            </NavItem>

                            <NavItem
                                target="_blank"
                                href="https://www.virtool.ca/docs/manual"
                                rel="noopener noreferrer"
                            >
                                <Icon name="book" />
                            </NavItem>

                            <NavDropdown id="account-dropdown" title={dropdownTitle}>
                                <LinkContainer to="/account" activeClassName="">
                                    <MenuItem>Account</MenuItem>
                                </LinkContainer>
                                {this.props.administrator ? (
                                    <LinkContainer to="/administration">
                                        <MenuItem>Administration</MenuItem>
                                    </LinkContainer>
                                ) : null}
                                <MenuItem href="https://gitreports.com/issue/virtool/virtool" target="_blank">
                                    Report Issue
                                </MenuItem>
                                <MenuItem onClick={this.props.logout}>Logout</MenuItem>
                            </NavDropdown>
                        </Nav>
                    </Navbar.Collapse>
                </Navbar>

                <AutoProgressBar step={50} interval={80} active={this.props.pending} affixed />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.account,
    pending: state.app.pending
});

const mapDispatchToProps = dispatch => ({
    logout: () => {
        dispatch(logout());
    },

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Bar);
