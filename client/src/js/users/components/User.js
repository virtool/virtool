/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Users
 */

import React from "react";
import { capitalize, map, get } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";

import { getUser, editUser, removeUser } from "../actions";
import {
    Flex,
    FlexItem,
    Identicon,
    InputError,
    Icon,
    LoadingPlaceholder,
    RemoveBanner,
    Alert
} from "../../base";
import Password from "./Password";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";
import { listGroups } from "../../groups/actions";


export class UserItem extends React.Component {

    componentDidMount () {
        this.props.onGetUser(this.props.match.params.userId);

        if (this.props.groups === null) {
            this.props.onListGroups();
        }
    }

    handleSetPrimaryGroup = (e) => {
        const value = e.target.value === "none" ? "" : e.target.value;
        this.props.onSetPrimaryGroup(this.props.detail.id, value);
    };

    toggleAdmin = (e) => {
        this.props.onSetUserRole(this.props.detail.id, (e.target.value === "Administrator"));
    };

    handleRemove = () => {
        this.props.onRemoveUser(this.props.detail.id);
    };

    render () {

        if (this.props.error.length) {
            return (
                <Alert bsStyle="warning" icon="warning">
                    <strong>You do not have permission to manage users.</strong>
                    <span> Contact an administrator.</span>
                </Alert>
            );
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const groupOptions = map(this.props.groups, group =>
            <option key={group.id} value={group.id}>
                {capitalize(group.id)}
            </option>
        );

        const currentRole = this.props.detail.administrator ? "Administrator" : "Limited";

        const canModifyUser = (this.props.activeUser !== this.props.detail.id && this.props.activeUserIsAdmin);

        return (
            <div>

                <Flex justifyContent="space-between">
                    <Flex alignItems="center">
                        <Identicon size={64} hash={this.props.detail.identicon} />
                        <FlexItem pad={10}>
                            <h5>
                                <strong>{this.props.detail.id}</strong>
                            </h5>
                        </FlexItem>
                        <FlexItem pad={10}>
                            {this.props.detail.administrator ? <Icon name="user-shield" bsStyle="primary" /> : null}
                        </FlexItem>
                    </Flex>
                    <Flex alignItems="center">
                        <FlexItem>
                            <Link to="/administration/users">
                                Back To List
                            </Link>
                        </FlexItem>
                    </Flex>
                </Flex>

                <div style={{marginTop: "20px"}}>
                    <label>Change Password</label>
                    <Password {...this.props} />

                    <label>Groups</label>
                    <UserGroups userId={this.props.detail.id} memberGroups={this.props.detail.groups} />

                    <label>Primary Group</label>
                    <InputError
                        type="select"
                        value={this.props.detail.primary_group}
                        onChange={this.handleSetPrimaryGroup}
                    >
                        <option key="none" value="none">None</option>
                        {groupOptions}
                    </InputError>

                    <Flex alignItems="center" justifyContent="space-between">
                        <label>Permissions</label>
                        <small className="text-muted">Change group membership to modify permissions</small>
                    </Flex>
                    <UserPermissions permissions={this.props.detail.permissions} />

                    {canModifyUser ? (
                        <React.Fragment>
                            <label>User Role</label>
                            <InputError
                                type="select"
                                value={currentRole}
                                onChange={this.toggleAdmin}
                            >
                                <option key="admin" value="Administrator">Administrator</option>
                                <option key="limit" value="Limited">Limited</option>
                            </InputError>
                        </React.Fragment>
                    ) : null}

                    {canModifyUser ? (
                        <RemoveBanner
                            message="Click the Delete button to permanently remove this user."
                            buttonText="Delete"
                            onClick={this.handleRemove}
                        />
                    ) : null}
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    detail: state.users.detail,
    activeUser: state.account.id,
    activeUserIsAdmin: state.account.administrator,
    groups: state.groups.list,
    error: get(state, "errors.GET_USER_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({

    onGetUser: (userId) => {
        dispatch(getUser(userId));
    },

    onRemoveUser: (userId) => {
        dispatch(removeUser(userId));
    },

    onClose: () => {
        dispatch(push("/administration/users"));
    },

    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(editUser(userId, {primary_group: groupId}));
    },

    onSetUserRole: (userId, isAdmin) => {
        dispatch(editUser(userId, {administrator: isAdmin}));
    },

    onListGroups: () => {
        dispatch(listGroups());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(UserItem);
