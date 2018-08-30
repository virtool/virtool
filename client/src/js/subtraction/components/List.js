import React from "react";
import { connect } from "react-redux";
import { isEqual } from "lodash-es";
import CreateSubtraction from "./Create";
import SubtractionToolbar from "./Toolbar";
import SubtractionItem from "./Item";
import { Alert, NoneFound, ViewHeader, ScrollList, LoadingPlaceholder } from "../../base";
import { checkAdminOrPermission } from "../../utils";
import { subtractionsSelector } from "../../listSelectors";
import { filterSubtractions, listSubtractions } from "../actions";

export class SubtractionList extends React.Component {

    componentDidMount () {
        if (!this.props.fetched) {
            this.props.loadNextPage(1);
        }
    }

    shouldComponentUpdate (nextProps) {
        return (
            !isEqual(nextProps.documents, this.props.documents)
            || !isEqual(nextProps.isLoading, this.props.isLoading)
            || !isEqual(nextProps.total_count, this.props.total_count)
        );
    }

    rowRenderer = (index) => (
        <SubtractionItem key={index} index={index} />
    );

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let subtractionComponents;
        let alert;

        if (this.props.documents.length) {
            subtractionComponents = (
                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.props.documents}
                    refetchPage={this.props.refetchPage}
                    loadNextPage={this.props.loadNextPage}
                    page={this.props.page}
                    rowRenderer={this.rowRenderer}
                />
            );
        } else {
            subtractionComponents = (
                <div className="list-group">
                    <NoneFound noun="subtractions" noListGroup />
                </div>
            );
        }

        if (!this.props.ready_host_count && !this.props.total_count && this.props.fetched) {
            alert = (
                <Alert bsStyle="warning" icon="info-circle">
                    <strong>
                        A host genome must be added before samples can be created and analyzed.
                    </strong>
                </Alert>
            );
        }

        return (
            <div>
                <ViewHeader title="Subtraction" totalCount={this.props.total_count} />

                {alert}

                <SubtractionToolbar
                    term={this.props.filter}
                    onFilter={this.props.onFilter}
                    canModify={this.props.canModify}
                />

                {subtractionComponents}

                <CreateSubtraction />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.subtraction,
    documents: subtractionsSelector(state),
    canModify: checkAdminOrPermission(state.account.administrator, state.account.permissions, "modify_subtraction")
});

const mapDispatchToProps = (dispatch) => ({

    onFilter: (e) => {
        dispatch(filterSubtractions(e.target.value));
    },

    loadNextPage: (page) => {
        if (page) {
            dispatch(listSubtractions(page));
        }
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionList);
