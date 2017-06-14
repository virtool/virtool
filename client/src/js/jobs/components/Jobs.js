/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { connect } from "react-redux";
import { Switch, Route } from "react-router-dom";

import { findJobs } from "../actions";
import JobsList from "./List";
import JobDetail from "./Detail";
import JobsResources from "./Resources";

const Jobs = () => {
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

const mapStateToProps = (state) => {
    return {
        documents: state.jobs.list
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findJobs());
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(Jobs);

export default Container;
