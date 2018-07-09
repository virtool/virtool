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
import UserItem from "./User";
import { ScrollList } from "../../base";
import { listUsers } from "../actions";
import { getUpdatedScrollListState } from "../../utils";

class UsersList extends React.Component {

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
        <UserItem
            key={this.state.masterList[index].id}
            {...this.state.masterList[index]}
            active={this.state.masterList[index].id === this.props.match.params.activeId}
            isAdmin={this.state.masterList[index].administrator}
            canSetRole={(this.props.activeUser !== this.state.masterList[index].id && this.props.activeUserIsAdmin)}
        />
    );

    render () {
        return (
            <ScrollList
                hasNextPage={this.props.page < this.props.page_count}
                isNextPageLoading={this.props.isLoading}
                isLoadError={this.props.errorLoad}
                list={this.state.masterList}
                loadNextPage={this.props.loadNextPage}
                page={this.state.page}
                rowRenderer={this.rowRenderer}
            />
        );
    }
}

const mapStateToProps = state => ({
    ...state.users.list,
    activeUser: state.account.id,
    activeUserIsAdmin: state.account.administrator
});

const mapDispatchToProps = (dispatch) => ({
    loadNextPage: (page) => {
        dispatch(listUsers(page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UsersList);
