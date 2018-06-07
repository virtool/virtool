import React from "react";
import { connect } from "react-redux";

import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";
import CreateSample from "./Create/Create";
import QuickAnalyze from "./QuickAnalyze";
import { LoadingPlaceholder, NoneFound, ScrollList, ViewHeader } from "../../base";
import { fetchSamples } from "../actions";
import { getUpdatedScrollListState } from "../../utils";

export class SamplesList extends React.Component {

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

    rowRenderer = (index) => (
        <SampleEntry
            key={this.state.masterList[index].id}
            id={this.state.masterList[index].id}
            userId={this.state.masterList[index].user.id}
            {...this.state.masterList[index]}
        />
    );

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noSamples;

        if (!this.state.masterList.length) {
            noSamples = <NoneFound key="noSample" noun="samples" noListGroup />;
        }

        return (
            <div>
                <ViewHeader
                    title="Samples"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                <SampleToolbar />

                {noSamples}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.onNextPage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />

                <CreateSample />

                <QuickAnalyze />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({...state.samples});

const mapDispatchToProps = (dispatch) => ({
    onNextPage: (page) => {
        dispatch(fetchSamples(page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
