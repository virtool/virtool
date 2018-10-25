/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UsersList
 */
import React from "react";
import { connect } from "react-redux";
import { isEqual } from "lodash-es";
import { ScrollList } from "../../base";
import { findUsers } from "../actions";
import UserItem from "./Item";

class UsersList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    shouldComponentUpdate(nextProps) {
        return (
            !isEqual(nextProps.documents, this.props.documents) || !isEqual(nextProps.isLoading, this.props.isLoading)
        );
    }

    renderRow = index => <UserItem key={index} index={index} />;

    render() {
        return (
            <ScrollList
                documents={this.props.documents}
                loadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                page={this.props.page}
                pageCount={this.props.page_count}
                renderRow={this.renderRow}
            />
        );
    }
}

const mapStateToProps = state => {
    const { documents, page, page_count, term } = state.users;

    return {
        documents,
        term,
        page,
        page_count
    };
};

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findUsers(term, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UsersList);
