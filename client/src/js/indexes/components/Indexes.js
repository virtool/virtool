import React from "react";
import { connect } from "react-redux";
import { LoadingPlaceholder, NoneFoundBox, ScrollList } from "../../base";
import { findIndexes } from "../actions";
import IndexItem from "./Item";
import RebuildIndex from "./Rebuild";
import RebuildAlert from "./RebuildAlert";

export class Indexes extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.refId, 1);
    }

    renderRow = index => <IndexItem key={index} index={index} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noIndexes;

        if (!this.props.documents.length) {
            noIndexes = <NoneFoundBox noun="indexes" />;
        }

        return (
            <React.Fragment>
                <RebuildAlert />
                <RebuildIndex />

                {noIndexes}

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.refId, page)}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            </React.Fragment>
        );
    }
}

const mapStateToProps = state => ({
    ...state.indexes,
    refId: state.references.detail.id
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (refId, page) => {
        dispatch(findIndexes(refId, null, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Indexes);
