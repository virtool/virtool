import React from "react";
import { map } from "lodash-es";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import { LoadingPlaceholder, Pagination, NoneFound, ViewHeader } from "../../base";
import { createFindURL } from "../../utils";

export const JobsList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let jobComponents;

    if (props.documents.length) {
        jobComponents = map(props.documents, doc =>
            <Job key={doc.id} {...doc} />
        );
    }

    if (!props.documents.length) {
        jobComponents = <NoneFound noun="jobs" noListGroup />;
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
                {jobComponents}
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

const mapStateToProps = (state) => {

    const { cancel_job, remove_job } = state.account.permissions;

    return {
        ...state.jobs,
        canCancel: cancel_job,
        canRemove: remove_job
    };
};

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobsList);
