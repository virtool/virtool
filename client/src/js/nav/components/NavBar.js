import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { logout } from "../../account/actions";
import { DropdownItem, Icon, VTLogo } from "../../base";
import { getSoftwareUpdates } from "../../updates/actions";
import { isHomeActive } from "../utils";
import { NavDropdown } from "./Dropdown";
import { NavBarItem } from "./NavBarItem";
import Update from "./Update";

const NavBarLeft = styled.div`
    display: flex;
    align-items: center;
`;

const NavBarRight = styled.div`
    display: flex;
    align-items: center;
    margin-right: calc(100% - 100vw + 20px);
`;

const NavBarLogo = styled(VTLogo)`
    margin: 0 30px 0 35px;
`;

const StyledNavBar = styled.div`
    background-color: ${props => props.theme.color.primary};
    color: white;
    display: flex;
    height: 45px;
    justify-content: space-between;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 90;
`;

export class Bar extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        return (
            <StyledNavBar>
                <NavBarLeft>
                    <NavBarLogo />

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
            </StyledNavBar>
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
