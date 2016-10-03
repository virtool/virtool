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

var React = require('react');

var JobList = require("./List.jsx");
var JobToolbar = require('./Toolbar.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

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
            sortDescending: false
        };
    },

    componentDidMount: function () {
        dispatcher.db.jobs.on("change", this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.jobs.off("change", this.update);
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
            documents: dispatcher.db.jobs.chain()
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
                />

                <JobList
                    route={this.props.route}
                    documents={documents}
                />
            </div>
        );
    }
});

module.exports = ManageJobs;