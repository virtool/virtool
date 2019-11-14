import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import { LoadingPlaceholder, TabLink, Tabs, ViewHeader, WideContainer } from "../../base";
import Updates from "../../updates/components/Viewer";

import UserDetail from "../../users/components/Detail";
import Users from "../../users/components/Users";
import { mapSettingsStateToProps } from "../mappers";
import { ServerSettings } from "./Server";

export const Settings = ({ loading }) => {
    let content;

    if (loading) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <Switch>
                <Redirect from="/administration" to="/administration/settings" exact />
                <Route path="/administration/settings" component={ServerSettings} />
                <Route path="/administration/users" component={Users} exact />
                <Route path="/administration/updates" component={Updates} />
                <Route path="/administration/users/:userId" component={UserDetail} />
            </Switch>
        );
    }

    return (
        <WideContainer>
            <ViewHeader title="Administration">
                <strong>Administration</strong>
            </ViewHeader>

            <Tabs bsStyle="tabs">
                <TabLink to="/administration/settings">Settings</TabLink>
                <TabLink to="/administration/users">Users</TabLink>
                <TabLink to="/administration/updates">Updates</TabLink>
            </Tabs>

            {content}
        </WideContainer>
    );
};

export default connect(mapSettingsStateToProps)(Settings);
