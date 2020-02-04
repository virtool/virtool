import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { NavLink } from "react-router-dom";
import { logout } from "../../account/actions";
import { DropDown, DropDownItem, AutoProgressBar, Icon, VTLogo } from "../../base";
import { isHomeActive } from "../utils";
import { getSoftwareUpdates } from "../../updates/actions";
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
    z-index: 1000;
    position: fixed;
    top: 0;
    width: 100%;
    height: 45px;

    display: flex;
    justify-content: space-between;

    background-color: teal;
    color: white;
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
    margin-left: 35px;
    margin-right: 25px;
    svg {
        margin-left: 3px;
    }
`;

export class Bar extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        const dropdownTitle = (
            <span>
                <Icon name="user" /> {this.props.id} <Icon name="caret-down" />
            </span>
        );

        return (
            <NavBar className="vt-header">
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

                    <NavBarItem target="_blank" to="//virtool.ca/docs/manual" rel="noopener noreferrer">
                        <Icon name="book" />
                    </NavBarItem>

                    <DropDown menuName={dropdownTitle}>
                        <DropDownItem to="/account">Account</DropDownItem>

                        {this.props.administrator ? (
                            <DropDownItem to="/administration">dministration </DropDownItem>
                        ) : null}

                        <DropDownItem
                            to="//gitreports.com/issue/virtool/virtool"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Report Issue
                        </DropDownItem>
                        <DropDownItem to="#" onClick={this.props.logout}>
                            Logout
                        </DropDownItem>
                    </DropDown>

                    <AutoProgressBar step={50} interval={80} active={this.props.pending} affixed />
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
