import React from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";
import { Nav, NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import SourceTypes from "./General/SourceTypes";
import InternalControl from "./General/InternalControl";
import UniqueNames from "./General/UniqueNames";
import SampleRights from "./General/SampleRights";
import HTTP from "./Server/HTTP";
import Proxy from "./Server/Proxy";
import Sentry from "./Server/Sentry";
import SSL from "./Server/SSL";
import Data from "./Data";
import Resources from "./Jobs/Resources";
import Tasks from "./Jobs/Tasks";
import Users from "../../users/components/Users";
import Updates from "../../updates/components/Viewer";
import { LoadingPlaceholder } from "../../base";

const General = () => (
    <div>
        <SourceTypes />
        <InternalControl />
        <UniqueNames />
        <SampleRights />
    </div>
);

const Server = () => (
    <div>
        <HTTP />
        <Proxy />
        <Sentry />
        <SSL />
    </div>
);

const Jobs = () => (
    <div>
        <Resources />
        <Tasks />
    </div>
);

const Settings = ({ settings }) => {
    let content;

    if (settings === null) {
        content = <LoadingPlaceholder />;
    } else {
        content = (
            <Switch>
                <Redirect from="/settings" to="/settings/general" exact />
                <Route path="/settings/general" component={General} />
                <Route path="/settings/server" component={Server} />
                <Route path="/settings/data" component={Data} />
                <Route path="/settings/jobs" component={Jobs} />
                <Route path="/settings/users" component={Users} />
                <Route path="/settings/updates" component={Updates} />
            </Switch>
        );
    }

    return (
        <div className="container">
            <h3 className="view-header">
                <strong>
                    Settings
                </strong>
            </h3>

            <Nav bsStyle="tabs">
                <LinkContainer to="/settings/general">
                    <NavItem>General</NavItem>
                </LinkContainer>

                <LinkContainer to="/settings/server">
                    <NavItem>Server</NavItem>
                </LinkContainer>

                <LinkContainer to="/settings/data">
                    <NavItem>Data</NavItem>
                </LinkContainer>

                <LinkContainer to="/settings/jobs">
                    <NavItem>Jobs</NavItem>
                </LinkContainer>

                <LinkContainer to="/settings/users">
                    <NavItem>Users</NavItem>
                </LinkContainer>

                <LinkContainer to="/settings/updates">
                    <NavItem>Updates</NavItem>
                </LinkContainer>
            </Nav>

            {content}
        </div>
    );
};

const mapStateToProps = (state) => ({
    settings: state.settings.data
});

export default connect(mapStateToProps)(Settings);
