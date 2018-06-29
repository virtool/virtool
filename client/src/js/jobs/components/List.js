import React from "react";
import { connect } from "react-redux";

import Job from "./Entry";
import JobsToolbar from "./Toolbar";
import { LoadingPlaceholder, ScrollList, NoneFound, ViewHeader } from "../../base";
import { fetchJobs } from "../actions";
import { getUpdatedScrollListState } from "../../utils";

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
        return getUpdatedScrollListState(nextProps, prevState);
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
                <ViewHeader title="Jobs" totalCount={this.props.total_count} />

                <JobsToolbar />

                {noJobs}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.props.onNextPage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.jobs
});

const mapDispatchToProps = (dispatch) => ({

    onNextPage: (page) => {
        dispatch(fetchJobs(page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobsList);
