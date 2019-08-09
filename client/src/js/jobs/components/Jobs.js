import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";
import { mapSettingsStateToProps } from "../../administration/mappers";
import { LoadingPlaceholder } from "../../base";
import JobsList from "./List";
import JobDetail from "./Detail";
import JobsResources from "./Resources";

export const Jobs = ({ loading }) => {
    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <div className="container">
            <Switch>
                <Route path="/jobs" component={JobsList} exact />
                <Route path="/jobs/resources" component={JobsResources} />
                <Route path="/jobs/:jobId" component={JobDetail} />
            </Switch>
        </div>
    );
};

export default connect(mapSettingsStateToProps)(Jobs);
