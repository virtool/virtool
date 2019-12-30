import React from "react";
import { connect } from "react-redux";

import { getIndexHistory } from "../actions";
import { LoadingPlaceholder, ScrollList } from "../../base";
import IndexChange from "./Change";

class IndexChanges extends React.Component {
    componentDidMount() {
        if (!this.props.history) {
            this.props.onLoadNextPage(this.props.detail.id, 1);
        }
    }

    render() {
        if (this.props.history === null || this.props.history.documents === null || this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <ScrollList
                documents={this.props.history.documents}
                onLoadNextPage={page => this.props.onLoadNextPage(this.props.detail.id, page)}
                page={this.props.history.page}
                pageCount={this.props.history.page_count}
                renderRow={index => <IndexChange key={index} index={index} />}
            />
        );
    }
}

const mapStateToProps = state => ({
    detail: state.indexes.detail,
    history: state.indexes.history
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (indexId, page) => {
        dispatch(getIndexHistory(indexId, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(IndexChanges);
