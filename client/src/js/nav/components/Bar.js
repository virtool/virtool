import React from "react";
import { startsWith } from "lodash-es";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem, Overlay } from "react-bootstrap";
import Notifications from "./Notifications";
import { logout } from "../../account/actions";
import { Icon, AutoProgressBar } from "../../base";
import { getSoftwareUpdates } from "../../updates/actions";
import { getUnbuilt } from "../../indexes/actions";

const isHomeActive = (match, location) => location.pathname === "/" || startsWith(location.pathname, "/home");

class Bar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            show: false,
            iconColor: ""
        };
    }

    handleToggle = () => {

        this.setState({
            show: !this.state.show
        });
    }

    componentWillMount () {
        this.props.onGet();
    }

    componentWillReceiveProps (nextProps) {
        if (this.props !== nextProps) {
            this.props.onGet();
        }
    }

    render () {

        const dropdownTitle = (
            <span>
                <Icon name="user" /> {this.props.id}
            </span>
        );

        const iconStyle = (this.props.updates || this.props.unbuilt) ? "yellow" : "white";

        return (
            <div className="vt-header">
                <Navbar fixedTop>
                    <Navbar.Header>
                        <Navbar.Brand>
                            <Icon name="vtlogo" className="vtlogo" />
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

                            {this.props.permissions.modify_settings ? (
                                <LinkContainer to="/settings">
                                    <NavItem>
                                        Settings
                                    </NavItem>
                                </LinkContainer>
                            ) : null}
                        </Nav>

                        <Nav pullRight>
                            <NavItem>
                                <div ref={node => this.target = node} onClick={this.handleToggle}>
                                    <Icon
                                        name="notification"
                                        tip="Click to see notifications"
                                        tipPlacement="left"
                                        style={{color: iconStyle}}
                                    />
                                </div>

                                <Overlay
                                    show={this.state.show}
                                    onHide={() => this.setState({ show: false })}
                                    placement="bottom"
                                    target={this.target}
                                >
                                    <Notifications onClick={this.handleToggle} />
                                </Overlay>
                            </NavItem>

                            <NavItem
                                target="_blank"
                                href="https://github.com/virtool/virtool"
                                rel="noopener noreferrer"
                            >
                                <Icon name="github" />
                            </NavItem>

                            <NavItem target="_blank" href="https://docs.virtool.ca" rel="noopener noreferrer">
                                <Icon name="book" />
                            </NavItem>

                            <NavDropdown id="account-dropdown" title={dropdownTitle}>
                                <LinkContainer to="/account" activeClassName="">
                                    <MenuItem>Account</MenuItem>
                                </LinkContainer>
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

const mapStateToProps = (state) => ({
    ...state.account,
    pending: state.app.pending,
    updates: state.updates.software,
    unbuilt: state.indexes.unbuilt
});

const mapDispatchToProps = (dispatch) => ({

    logout: () => {
        dispatch(logout());
    },

    onGet: () => {
        dispatch(getSoftwareUpdates());
    },

    onGetUnbuilt: () => {
        dispatch(getUnbuilt());
    }
});

const BarContainer = withRouter(connect(mapStateToProps, mapDispatchToProps)(Bar));

export default BarContainer;
