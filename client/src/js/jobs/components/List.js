import React from "react";
import { connect } from "react-redux";

import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import { LoadingPlaceholder, ScrollList, NoneFound, ViewHeader } from "../../base";
import { listJobs } from "../actions";
import { getUpdatedScrollListState, checkAdminOrPermission } from "../../utils";

export class JobsList extends React.Component {

    componentDidMount () {
        if (!this.props.fetched) {
            this.props.loadNextPage(1);
        }
    }

    rowRenderer = (index) => (
        <Job
            key={this.props.documents[index].id}
            {...this.props.documents[index]}
            canRemove={this.props.canRemove}
            canCancel={this.props.canCancel}
        />
    );

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noJobs;

        if (!this.props.documents.length) {
            noJobs = <NoneFound noun="jobs" noListGroup />;
        }

        return (
            <div>
                <ViewHeader title="Jobs" totalCount={this.props.total_count} />

                <JobsToolbar />

                {noJobs}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.props.documents}
                    loadNextPage={this.props.loadNextPage}
                    page={this.props.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.jobs,
    canRemove: checkAdminOrPermission(state.account.administrator, state.account.permissions, "remove_job"),
    canCancel: checkAdminOrPermission(state.account.administrator, state.account.permissions, "cancel_job")
});

const mapDispatchToProps = (dispatch) => ({

    loadNextPage: (page) => {
        dispatch(listJobs(page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobsList);
