import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Switch, Redirect, Route } from "react-router-dom";
import { Nav, NavItem } from "react-bootstrap";

import { getAccount } from "../actions";
import AccountGeneral from "./General";
import AccountSettings from "./Settings";
import APIKeys from "./API";

class Account extends React.Component {

    componentWillMount () {
        this.props.onGet();
    }

    render () {
        return (
            <div className="container">
                <h3 className="view-header">
                    <strong>Account</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to="/account/general">
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to="/account/settings">
                        <NavItem>Settings</NavItem>
                    </LinkContainer>
                    <LinkContainer to="/account/api">
                        <NavItem>API</NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect from="/account" to="/account/general" exact/>
                    <Route path="/account/general" component={AccountGeneral}/>
                    <Route path="/account/settings" component={AccountSettings}/>
                    <Route path="/account/api" component={APIKeys}/>
                </Switch>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({account: state.account});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getAccount());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(Account);

export default Container;
