import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import { LoadingPlaceholder, Pagination, NoneFound, ViewHeader } from "../../base";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import {createFindURL} from "../../utils";

class JobsList extends React.Component {

    componentDidMount () {
        this.props.onPage();
    }

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

        return (
            <div>
                <ViewHeader
                    title="Jobs"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                <JobsToolbar />

                <ListGroup>
                    {components}
                </ListGroup>

                <Pagination
                    documentCount={this.props.documents.length}
                    onPage={this.props.onPage}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({...state.jobs});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
        dispatch(findJobs());
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
