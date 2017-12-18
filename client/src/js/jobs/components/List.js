import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import { LoadingPlaceholder, Pagination, NoneFound, ViewHeader } from "../../base";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";

class JobsList extends React.Component {

    componentDidMount () {
        this.props.onFind();
    }

    handleChange = (term) => {
        const url = new window.URL(window.location);

        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }

        this.props.onFind(url);
    };

    handlePage = (page) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        this.props.onFind(url);
    };

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let components = this.props.documents.map(doc =>
            <Job
                key={doc.id}
                {...doc}
                cancel={this.props.onCancel}
                remove={this.props.onRemove}
                navigate={() => this.props.history.push(`/jobs/${doc.id}`)}
            />
        );

        if (!this.props.documents.length) {
            components = <NoneFound noun="jobs" noListGroup />;
        }

        const url = new window.URL(window.location);

        const term = url.searchParams.get("find") || "";

        return (
            <div>
                <ViewHeader
                    title="Jobs"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                <JobsToolbar value={term} onChange={this.handleChange} />

                <ListGroup>
                    {components}
                </ListGroup>

                <Pagination
                    documentCount={this.props.documents.length}
                    onPage={this.handlePage}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({...state.jobs});

const mapDispatchToProps = (dispatch) => ({

    onFind: (url = new window.URL(window.location)) => {
        dispatch(push(url.pathname + url.search));
        dispatch(findJobs(url.searchParams.get("find"), url.searchParams.get("page") || 1));
    },

    onCancel: (jobId) => {
        dispatch(cancelJob(jobId));
    },

    onRemove: (jobId) => {
        dispatch(removeJob(jobId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(JobsList);

export default Container;
