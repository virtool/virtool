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

import React from "react";
import JobList from "./List";
import JobsToolbar from "./Toolbar";

const progressSortFunction = (a, b) => {

    if (a.state === "running") {
        if (b.state === "running") {
            return a.progress > b.progress ? -1: 1;
        }
        return 1;
    }

    if (a.state === "waiting") {
        if (b.state !== "waiting") {
            return 1;
        }
    }

    return 0;
};

export default class ManageJobs extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            documents: dispatcher.db.jobs.chain(),
            findTerm: "",
            sortTerm: "progress",
            sortDescending: false,

            canCancel: dispatcher.user.permissions.cancel_job,
            canRemove: dispatcher.user.permissions.remove_job
        }
    }

    static propTypes = {
        route: React.PropTypes.any
    };

    componentDidMount () {
        dispatcher.db.jobs.on("change", this.update);
        dispatcher.user.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.jobs.off("change", this.update);
        dispatcher.user.off("change", this.update);
    }

    setFindTerm = (event) => {
        this.setState({
            findTerm: event.target.value || ""
        });
    };

    setSortTerm = (term) => {
        this.setState({
            sortTerm: term
        });
    };

    changeDirection = () => {
        this.setState({
            sortDescending: !this.state.sortDescending
        });
    };

    update = () => {
        this.setState({
            documents: dispatcher.db.jobs.chain(),

            canCancel: dispatcher.user.permissions.cancel_job,
            canRemove: dispatcher.user.permissions.remove_job
        });
    };

    render () {

        let documents;

        if (this.state.documents.count() > 0) {

            let query = {};

            if (this.state.findTerm) {
                const test = {$regex: [this.state.findTerm, "i"]};

                query = {$or: [
                    {task: test},
                    {state: test},
                    {username: test}
                ]};
            }

            documents = this.state.documents.branch().find(query).sort(progressSortFunction).data();

            if (!this.state.sortDescending) {
                documents.reverse();
            }
        }

        return (
            <div>
                <JobsToolbar
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
}
