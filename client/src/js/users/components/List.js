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
import { ScrollList } from "../../base";
import { findUsers } from "../actions";
import { getTerm } from "../selectors";
import UserItem from "./Item";

export class UsersList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    renderRow = index => <UserItem key={index} index={index} />;

    render() {
        return (
            <ScrollList
                documents={this.props.documents}
                onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                page={this.props.page}
                pageCount={this.props.page_count}
                renderRow={this.renderRow}
            />
        );
    }
}

export const mapStateToProps = state => {
    const { documents, page, page_count } = state.users;

    return {
        documents,
        term: getTerm(state),
        page,
        page_count
    };
};

export const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findUsers(term, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UsersList);
