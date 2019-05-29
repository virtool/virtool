import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import { LoadingPlaceholder, TabLink, Tabs, ViewHeader } from "../../base";
import Updates from "../../updates/components/Viewer";

import User from "../../users/components/User";
import Users from "../../users/components/Users";
import { ServerSettings } from "./Server";

export const Settings = ({ settings }) => {
    let content;

    if (settings === null) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <Switch>
                <Redirect from="/administration" to="/administration/settings" exact />
                <Route path="/administration/settings" component={ServerSettings} />
                <Route path="/administration/users" component={Users} exact />
                <Route path="/administration/updates" component={Updates} />
                <Route path="/administration/users/:userId" component={User} />
            </Switch>
        );
    }

    return (
        <div className="container-noside">
            <ViewHeader title="Administration">
                <strong>Administration</strong>
            </ViewHeader>

            <Tabs bsStyle="tabs">
                <TabLink to="/administration/settings">Settings</TabLink>
                <TabLink to="/administration/users">Users</TabLink>
                <TabLink to="/administration/updates">Updates</TabLink>
            </Tabs>

            {content}
        </div>
    );
};

const mapStateToProps = state => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Settings);
