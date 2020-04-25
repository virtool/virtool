import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Alert, Icon, LinkButton, LoadingPlaceholder, SearchInput, Toolbar } from "../../base";
import { clearError } from "../../errors/actions";
import { listGroups } from "../../groups/actions";
import Groups from "../../groups/components/Groups";
import { findUsers } from "../actions";
import CreateUser from "./Create";
import UsersList from "./List";

export class ManageUsers extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            error: ""
        };
    }

    componentDidMount() {
        if (!this.props.groupsFetched) {
            this.props.onListGroups();
        }
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!nextProps.isAdmin && prevState.error !== nextProps.error) {
            return { error: nextProps.error };
        }
        return null;
    }

    componentWillUnmount() {
        if (this.props.error.length) {
            this.props.onClearError("LIST_USERS_ERROR");
        }
    }

    render() {
        if (this.state.error.length) {
            return (
                <Alert color="orange" level>
                    <Icon name="exclamation-circle" />
                    <span>
                        <strong>You do not have permission to manage users.</strong>
                        <span> Contact an administrator.</span>
                    </span>
                </Alert>
            );
        }

        if (this.props.groups === null) {
            return <LoadingPlaceholder margin="220px" />;
        }

        return (
            <div>
                <Toolbar>
                    <SearchInput name="search" value={this.state.term} onChange={this.props.onFind} />
                    <LinkButton to={{ state: { groups: true } }} icon="users" tip="Manage Group" />
                    <LinkButton to={{ state: { createUser: true } }} icon="user-plus" tip="Create User" color="blue" />
                </Toolbar>

                <UsersList />

                <CreateUser />
                <Groups />
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    isAdmin: state.account.administrator,
    term: state.users.filter,
    groups: state.groups.list,
    groupsFetched: state.groups.fetched,
    error: get(state, "errors.LIST_USERS_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findUsers(e.target.value || null, 1));
    },

    onClearError: error => {
        dispatch(clearError(error));
    },

    onListGroups: () => {
        dispatch(listGroups());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ManageUsers);
