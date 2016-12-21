/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ManageJobs
 */

'use strict';

import React from 'react';
import JobList from "./List.jsx";
import JobToolbar from './Toolbar.jsx';

var progressSortFunction = function (a, b) {

    if (a.state === "running") {
        // Always place before waiting jobs.
        if (b.state === "waiting") {
            return -1;
        }

        // Sort by the progress field if both jobs are running.
        if (b.state === "running") {
            return a.progress > b.progress ? -1: 1;
        }

        // Finished jobs go before running jobs.
        return 1;
    }

    if (a.state === "complete") {
        return  b.state === "complete" ? 0: -1;
    }

    if (a.state === "cancelled") {
        if (b.state === "complete") {
            return 1;
        }

        if (b.state === "cancelled") {
            return 0;
        }

        return -1;
    }

    if (a.state === "error") {
        if (b.state === "complete") {
            return 1;
        }

        if (b.state === "error") {
            return 0;
        }

        return -1;
    }

    return 0;
};

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only active jobs.
 *
 * @class
 */
var ManageJobs = React.createClass({

    getInitialState: function () {
        return {
            documents: dispatcher.db.jobs.chain(),
            findTerm: "",
            sortTerm: "progress",
            sortDescending: false,

            canCancel: dispatcher.user.permissions.cancel_job,
            canRemove: dispatcher.user.permissions.remove_job
        };
    },

    componentDidMount: function () {
        dispatcher.db.jobs.on("change", this.update);
        dispatcher.user.on("change", this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.jobs.off("change", this.update);
        dispatcher.user.off("change", this.update);
    },

    setFindTerm: function (event) {
        this.setState({
            findTerm: event.target.value || ""
        });
    },

    setSortTerm: function (term) {
        this.setState({
            sortTerm: term
        });
    },

    changeDirection: function () {
        this.setState({
            sortDescending: !this.state.sortDescending
        });
    },

    update: function () {
        this.setState({
            documents: dispatcher.db.jobs.chain(),

            canCancel: dispatcher.user.permissions.cancel_job,
            canRemove: dispatcher.user.permissions.remove_job
        });
    },

    render: function () {

        var documents;

        if (this.state.documents.count() > 0) {

            var query = {};

            if (this.state.findTerm) {
                var test = {$regex: [this.state.findTerm, "i"]};

                query = {$or: [
                    {task: test},
                    {state: test},
                    {username: test}
                ]};
            }

            documents = this.state.documents.branch().find(query).sort(progressSortFunction).data();

            if (this.state.sortDescending) {
                documents.reverse();
            }
        }

        return (
            <div>
                <JobToolbar
                    findTerm={this.state.findTerm}
                    sortTerm={this.state.sortTerm}
                    sortDescending={this.state.sortDescending}

                    setFindTerm={this.setFindTerm}
                    setSortTerm={this.setSortTerm}
                    changeDirection={this.changeDirection}

                    canRemove={this.state.canRemove}
                />

                <JobList
                    route={this.props.route}
                    documents={documents}

                    canCancel={this.state.canCancel}
                    canRemove={this.state.canRemove}
                />
            </div>
        );
    }
});

module.exports = ManageJobs;