import React from "react";
import { connect } from "react-redux";
import { Badge, LoadingPlaceholder, NoneFoundBox, ScrollList, ViewHeader, ViewHeaderTitle } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { findJobs } from "../actions";
import { getTerm } from "../selectors";
import Job from "./Item/Item";
import JobsToolbar from "./Toolbar";

export class JobsList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    renderRow = index => {
        const document = this.props.documents[index];
        return (
            <Job key={document.id} {...document} canRemove={this.props.canRemove} canCancel={this.props.canCancel} />
        );
    };

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noneFound;

        if (!this.props.documents.length) {
            noneFound = <NoneFoundBox noun="jobs" />;
        }

        return (
            <React.Fragment>
                <ViewHeader title="Jobs">
                    <ViewHeaderTitle>
                        Jobs <Badge>{this.props.total_count}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>

                <JobsToolbar />

                {noneFound}

                <ScrollList
                    documents={this.props.documents}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                    renderRow={this.renderRow}
                />
            </React.Fragment>
        );
    }
}

export const mapStateToProps = state => ({
    ...state.jobs,
    term: getTerm(state),
    canCancel: checkAdminOrPermission(state, "cancel_job"),
    canRemove: checkAdminOrPermission(state, "remove_job")
});

export const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findJobs(term, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(JobsList);
