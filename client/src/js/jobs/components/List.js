import React from "react";
import { connect } from "react-redux";

import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import { LoadingPlaceholder, ScrollList, NoneFound, ViewHeader } from "../../base";
import { fetchJobs } from "../actions";
import { isArrayEqual } from "../../utils";

export class JobsList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };
    }

    static getDerivedStateFromProps (nextProps, prevState) {

        if (nextProps.page === 1) {
            return {
                masterList: nextProps.documents,
                list: nextProps.documents,
                page: nextProps.page
            };
        }

        if (prevState.page !== nextProps.page) {
            return {
                masterList: prevState.masterList.concat(nextProps.documents),
                list: nextProps.documents,
                page: nextProps.page
            };
        } else if (!isArrayEqual(prevState.list, nextProps.documents)) {
            return {
                masterList: nextProps.documents,
                list: nextProps.documents
            };
        }

        return null;
    }

    componentDidMount () {
        this.props.onNextPage(1);
    }

    rowRenderer = (index) => (
        <Job key={this.state.masterList[index].id} {...this.state.masterList[index]} />
    );

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noJobs;

        if (!this.state.masterList.length) {
            noJobs = <NoneFound noun="jobs" noListGroup />;
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

                {noJobs}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.onNextPage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {

    const { cancel_job, remove_job } = state.account.permissions;

    return {
        ...state.jobs,
        canCancel: cancel_job,
        canRemove: remove_job
    };
};

const mapDispatchToProps = (dispatch) => ({

    onNextPage: (page) => {
        dispatch(fetchJobs(page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobsList);
