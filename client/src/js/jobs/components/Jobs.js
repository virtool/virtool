import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";
import { LoadingPlaceholder } from "../../base";
import JobsList from "./List";
import JobDetail from "./Detail";
import JobsResources from "./Resources";

const Jobs = props => {
    if (props.settings === null) {
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

const mapStateToProps = state => ({
    settings: state.settings.data
});

export default connect(
    mapStateToProps,
    null
)(Jobs);
