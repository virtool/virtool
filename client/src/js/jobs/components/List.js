import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";

import { cancelJob, removeJob } from "../actions";
import { LoadingPlaceholder, Pagination, NoneFound, ViewHeader } from "../../base";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import {createFindURL} from "../../utils";

const JobsList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let components = props.documents.map(doc =>
        <Job
            key={doc.id}
            {...doc}
            cancel={props.onCancel}
            remove={props.onRemove}
            navigate={() => props.history.push(`/jobs/${doc.id}`)}
        />
    );

    if (!props.documents.length) {
        components = <NoneFound noun="jobs" noListGroup />;
    }

    return (
        <div>
            <ViewHeader
                title="Jobs"
                page={props.page}
                count={props.documents.length}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            <JobsToolbar />

            <ListGroup>
                {components}
            </ListGroup>

            <Pagination
                documentCount={props.documents.length}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />
        </div>
    );
};

const mapStateToProps = (state) => ({...state.jobs});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
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
