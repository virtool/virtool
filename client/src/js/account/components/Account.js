import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Switch, Redirect, Route } from "react-router-dom";
import { Nav, NavItem } from "react-bootstrap";

import { ViewHeader } from "../../base";
import { getAccount } from "../actions";
import AccountGeneral from "./General";
import AccountSettings from "./Settings";
import APIKeys from "./API/API";

class Account extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        return (
            <div className="container-noside">
                <ViewHeader title="Account">
                    <strong>Account</strong>
                </ViewHeader>
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
                    <Redirect from="/account" to="/account/general" exact />
                    <Route path="/account/general" component={AccountGeneral} />
                    <Route path="/account/settings" component={AccountSettings} />
                    <Route path="/account/api" component={APIKeys} />
                </Switch>
            </div>
        );
    }
}

const mapDispatchToProps = dispatch => ({
    onGet: () => {
        dispatch(getAccount());
    }
});

export default connect(
    null,
    mapDispatchToProps
)(Account);
