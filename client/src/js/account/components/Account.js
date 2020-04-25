import React, { useEffect } from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";

import { TabLink, Tabs, ViewHeader, ViewHeaderTitle, WideContainer } from "../../base";
import { getAccount } from "../actions";
import AccountProfile from "./Profile";
import APIKeys from "./API/API";

export const Account = ({ userId, onGet }) => {
    useEffect(() => onGet(), [userId]);

    return (
        <WideContainer>
            <ViewHeader title="Account">
                <ViewHeaderTitle>Account</ViewHeaderTitle>
            </ViewHeader>

            <Tabs>
                <TabLink to="/account/profile">Profile</TabLink>
                <TabLink to="/account/api">API</TabLink>
            </Tabs>

            <Switch>
                <Redirect from="/account" to="/account/profile" exact />
                <Route path="/account/profile" component={AccountProfile} />
                <Route path="/account/api" component={APIKeys} />
            </Switch>
        </WideContainer>
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

export default connect(mapStateToProps, mapDispatchToProps)(Account);
