import React from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";

import User from "../../users/components/User";
import Users from "../../users/components/Users";
import Updates from "../../updates/components/Viewer";
import { LoadingPlaceholder, Tabs, TabLink, ViewHeader } from "../../base";
import Sentry from "./Sentry";

export const Server = () => (
    <div className="settings-container">
        <Sentry />
    </div>
);

export const Settings = ({ settings }) => {
    let content;

    if (settings === null) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <Switch>
                <Redirect from="/administration" to="/administration/server" exact />
                <Route path="/administration/server" component={Server} />
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
                <TabLink to="/administration/server">Server</TabLink>
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
