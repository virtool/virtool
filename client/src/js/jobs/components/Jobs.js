import React from "react";
import { connect } from "react-redux";
import { Route, Switch } from "react-router-dom";
import { mapSettingsStateToProps } from "../../administration/mappers";
import { Container, LoadingPlaceholder } from "../../base";
import JobDetail from "./Detail";
import JobsList from "./List";
import JobsResources from "./Resources";

export const Jobs = ({ loading }) => {
    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <Container>
            <Switch>
                <Route path="/jobs" component={JobsList} exact />
                <Route path="/jobs/resources" component={JobsResources} />
                <Route path="/jobs/:jobId" component={JobDetail} />
            </Switch>
        </Container>
    );
};

export default connect(mapSettingsStateToProps)(Jobs);
