import React from "react";
import { startsWith } from "lodash-es";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem } from "react-bootstrap";

import { logout } from "../../account/actions";
import { getSoftwareUpdates } from "../../updates/actions";
import { Icon, AutoProgressBar, VTLogo } from "../../base";
import Update from "./Update";

const isHomeActive = (match, location) =>
  location.pathname === "/" || startsWith(location.pathname, "/home");

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
              <VTLogo />
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

              <NavItem
                target="_blank"
                href="https://github.com/virtool/virtool"
                rel="noopener noreferrer"
              >
                <Icon name="github" faStyle="fab" />
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
                <LinkContainer to="/administration">
                  <MenuItem>Administration</MenuItem>
                </LinkContainer>
                <MenuItem
                  href="https://gitreports.com/issue/virtool/virtool"
                  target="_blank"
                >
                  Report Issue
                </MenuItem>
                <MenuItem onClick={this.props.logout}>Logout</MenuItem>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <AutoProgressBar
          step={50}
          interval={80}
          active={this.props.pending}
          affixed
        />
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

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Bar)
);
