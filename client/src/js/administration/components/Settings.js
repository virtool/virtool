import React from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";
import { Nav, NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import User from "../../users/components/User";
import Users from "../../users/components/Users";
import Updates from "../../updates/components/Viewer";
import { LoadingPlaceholder, ViewHeader } from "../../base";
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

            <Nav bsStyle="tabs">
                <LinkContainer to="/administration/server">
                    <NavItem>Server</NavItem>
                </LinkContainer>
                <LinkContainer to="/administration/users">
                    <NavItem>Users</NavItem>
                </LinkContainer>
                <LinkContainer to="/administration/updates">
                    <NavItem>Updates</NavItem>
                </LinkContainer>
            </Nav>

            {content}
        </div>
    );
};

const mapStateToProps = state => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Settings);
