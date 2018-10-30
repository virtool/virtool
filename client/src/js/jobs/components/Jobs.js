import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";
import Resources from "../../administration/components/Jobs/Resources";
import Tasks from "../../administration/components/Jobs/Tasks";
import { LoadingPlaceholder } from "../../base";
import JobsList from "./List";
import JobDetail from "./Detail";
import JobsResources from "./Resources";

export const JobsSettings = () => (
    <div className="settings-container">
        <h3 className="view-header">
            <strong>Job Settings</strong>
        </h3>
        <Resources />
        <Tasks />
    </div>
);

const Jobs = props => {
    if (props.settings === null) {
        return <LoadingPlaceholder />;
    }

    return (
        <div className="container">
            <Switch>
                <Route path="/jobs" component={JobsList} exact />
                <Route path="/jobs/resources" component={JobsResources} />
                <Route path="/jobs/settings" component={JobsSettings} />
                <Route path="/jobs/:jobId" component={JobDetail} />
            </Switch>
        </div>
    );
};

const mapStateToProps = state => ({
    settings: state.settings.data
});

export default connect(
    mapStateToProps,
    null
)(Jobs);
