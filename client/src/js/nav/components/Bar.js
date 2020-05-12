import React from "react";
import { connect } from "react-redux";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { logout } from "../../account/actions";
import { DropdownItem, Icon, VTLogo } from "../../base";
import { getSoftwareUpdates } from "../../updates/actions";
import { isHomeActive } from "../utils";
import { NavDropdown } from "./Dropdown";
import Update from "./Update";

const NavBarItem = styled(NavLink)`
    color: white;
    cursor: pointer;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 15px;

    &:focus {
        text-decoration: none;
    }

    &:hover {
        opacity: 1;
        text-decoration: none;
        color: #245251;
    }

    &.active {
        color: white;
        opacity: 1;
        background-color: rgb(50, 112, 111);
    }
`;

const NavBar = styled.div`
    background-color: ${props => props.theme.color.primary};
    color: white;
    display: flex;
    height: 45px;
    justify-content: space-between;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 1000;
`;

const NavBarLeft = styled.div`
    display: flex;
    align-items: center;
`;

const NavBarRight = styled.div`
    display: flex;
    align-items: center;
    margin-right: 15px;
`;

const BarLogo = styled(VTLogo)`
    margin: 0 30px 0 35px;
`;

export class Bar extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        return (
            <NavBar>
                <NavBarLeft>
                    <BarLogo />

                    <NavBarItem to="/home" isActive={isHomeActive}>
                        Home
                    </NavBarItem>

                    <NavBarItem to="/jobs">Jobs</NavBarItem>

                    <NavBarItem to="/samples">Samples</NavBarItem>

                    <NavBarItem to="/refs">References</NavBarItem>

                    <NavBarItem to="/hmm">HMM</NavBarItem>

                    <NavBarItem to="/subtraction">Subtraction</NavBarItem>
                </NavBarLeft>

                <NavBarRight>
                    <Update />

                    <NavBarItem target="_blank" to="//gitter.im/virtool/virtool" rel="noopener noreferrer">
                        <Icon name="comments" />
                    </NavBarItem>

                    <NavBarItem
                        target="_blank"
                        to="//virtool.ca/docs/manual"
                        rel="noopener noreferrer"
                        style={{ paddingLeft: 0 }}
                    >
                        <Icon name="book" />
                    </NavBarItem>

                    <NavDropdown userId={this.props.id}>
                        <DropdownItem to="/account">Account</DropdownItem>

                        {this.props.administrator && <DropdownItem to="/administration">Administration </DropdownItem>}

                        <DropdownItem
                            to="//gitreports.com/issue/virtool/virtool"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Report Issue
                        </DropdownItem>

                        <DropdownItem onClick={this.props.logout}>Logout</DropdownItem>
                    </NavDropdown>
                </NavBarRight>
            </NavBar>
        );
    }
}

export const mapStateToProps = state => ({
    ...state.account,
    pending: state.app.pending
});

export const mapDispatchToProps = dispatch => ({
    logout: () => {
        dispatch(logout());
    },

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Bar);
