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

import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { device, Icon, Identicon, LoadingPlaceholder, RemoveBanner, WarningAlert } from "../../base";
import { listGroups } from "../../groups/actions";

import { getUser, removeUser } from "../actions";
import { getCanModifyUser } from "../selectors";
import UserGroups from "./Groups";
import Password from "./Password";
import UserPermissions from "./Permissions";
import PrimaryGroup from "./PrimaryGroup";
import UserRole from "./Role";

const UserDetailGroups = styled.div`
    margin-bottom: 15px;

    @media (min-width: ${device.tablet}) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 17px;
    }
`;

const UserDetailHeader = styled.div`
    display: flex;
    margin-bottom: 20px;
`;

const UserDetailTitle = styled.div`
    display: flex;
    flex: 1 0 auto;
    font-size: 18px;
    font-weight: bold;
    padding: 10px 0 0 15px;

    a {
        font-size: 14px;
        margin-left: auto;
    }
`;

export class UserDetail extends React.Component {
    componentDidMount() {
        this.props.onGetUser(this.props.match.params.userId);
        this.props.onListGroups();
    }

    handleRemove = () => {
        this.props.onRemoveUser(this.props.detail.id);
    };

    render() {
        if (this.props.error.length) {
            return (
                <WarningAlert level>
                    <Icon name="exclamation-circle" />
                    <span>
                        <strong>You do not have permission to manage users.</strong>
                        <span> Contact an administrator.</span>
                    </span>
                </WarningAlert>
            );
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const { id, identicon, administrator } = this.props.detail;

        return (
            <div>
                <UserDetailHeader>
                    <Identicon size={56} hash={identicon} />
                    <UserDetailTitle>
                        <span>{id}</span>
                        {administrator ? <Icon name="user-shield" bsStyle="primary" /> : null}
                        <Link to="/administration/users">Back To List</Link>
                    </UserDetailTitle>
                </UserDetailHeader>

                <Password />

                <UserDetailGroups>
                    <div>
                        <UserGroups />
                        <PrimaryGroup />
                    </div>
                    <UserPermissions />
                </UserDetailGroups>

                <UserRole />

                {this.props.canModifyUser ? (
                    <RemoveBanner
                        message="Click the Delete button to permanently remove this user."
                        buttonText="Delete"
                        onClick={this.handleRemove}
                    />
                ) : null}
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    canModifyUser: getCanModifyUser(state),
    detail: state.users.detail,
    error: get(state, "errors.GET_USER_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onGetUser: userId => {
        dispatch(getUser(userId));
    },

    onRemoveUser: userId => {
        dispatch(removeUser(userId));
    },

    onListGroups: () => {
        dispatch(listGroups());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UserDetail);
