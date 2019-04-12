import React, { useEffect } from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";

import { TabLink, Tabs, ViewHeader } from "../../base";
import { getAccount } from "../actions";
import AccountGeneral from "./General";
import AccountSettings from "./Settings";
import APIKeys from "./API/API";

export const Account = ({ userId, onGet }) => {
    useEffect(() => onGet(), [userId]);

    return (
        <div className="container-noside">
            <ViewHeader title="Account">
                <strong>Account</strong>
            </ViewHeader>

            <Tabs>
                <TabLink to="/account/general">General</TabLink>
                <TabLink to="/account/settings">Settings</TabLink>
                <TabLink to="/account/api">API</TabLink>
            </Tabs>

            <Switch>
                <Redirect from="/account" to="/account/general" exact />
                <Route path="/account/general" component={AccountGeneral} />
                <Route path="/account/settings" component={AccountSettings} />
                <Route path="/account/api" component={APIKeys} />
            </Switch>
        </div>
    );
};

export const mapStateToProps = state => ({
    userId: state.account.id
});

export const mapDispatchToProps = dispatch => ({
    onGet: () => {
        dispatch(getAccount());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Account);
