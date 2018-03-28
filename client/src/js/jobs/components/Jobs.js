import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";

import { findJobs } from "../actions";
import JobsList from "./List";
import JobDetail from "./Detail";
import JobsResources from "./Resources";

const Jobs = () => (
    <div className="container">
        <Switch>
            <Route path="/jobs" component={JobsList} exact />
            <Route path="/jobs/resources" component={JobsResources} />
            <Route path="/jobs/:jobId" component={JobDetail} />
        </Switch>
    </div>
);

const mapStateToProps = (state) => ({
    documents: state.jobs.list
});

const mapDispatchToProps = (dispatch) => ({

    onFind: () => {
        dispatch(findJobs());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Jobs);
