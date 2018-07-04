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
import { capitalize, map } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";

import { editUser } from "../actions";
import { Flex, FlexItem, Identicon, InputError, Icon } from "../../base";
import Password from "./Password";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";


export class UserItem extends React.Component {

    handleSetPrimaryGroup = (e) => {
        this.props.onSetPrimaryGroup(this.props.id, e.target.value);
    };

    toggleAdmin = (e) => {
        this.props.onSetUserRole(this.props.id, (e.target.value === "Administrator"));
    };

    render () {

        let closeButton;

        if (this.props.active) {
            closeButton = (
                <button type="button" className="close" onClick={this.props.onClose}>
                    <span>×</span>
                </button>
            );
        }

        const identifier = (
            <Flex alignItems="center">
                <Identicon size={32} hash={this.props.identicon} />
                <FlexItem pad={10}>
                    {this.props.id}
                </FlexItem>
                <FlexItem pad={10}>
                    {this.props.isAdmin ? <Icon name="user-shield" bsStyle="primary" /> : null}
                </FlexItem>
                <FlexItem grow={1} shrink={1}>
                    {closeButton}
                </FlexItem>
            </Flex>
        );

        if (this.props.active) {
            const groupOptions = map(this.props.groups, group =>
                <option key={group} value={group}>
                    {capitalize(group)}
                </option>
            );

            const currentRole = this.props.isAdmin ? "Administrator" : "Limited";

            return (
                <div className="list-group-item spaced" style={{paddingLeft: "10px"}}>

                    {identifier}

                    <div style={{marginTop: "20px"}}>
                        <label>Change Password</label>
                        <Password {...this.props} />

                        <label>Groups</label>
                        <UserGroups userId={this.props.id} memberGroups={this.props.groups} />

                        <label>Primary Group</label>
                        <InputError
                            type="select"
                            value={this.props.primary_group}
                            onChange={this.handleSetPrimaryGroup}
                        >
                            <option key="none" value="none">None</option>
                            {groupOptions}
                        </InputError>

                        <Flex alignItems="center" justifyContent="space-between">
                            <label>Permissions</label>
                            <small className="text-muted">Change group membership to modify permissions</small>
                        </Flex>
                        <UserPermissions permissions={this.props.permissions} />

                        {this.props.canSetRole ? (
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
                    </div>
                </div>
            );
        }

        return (
            <LinkContainer to={`/administration/users/${this.props.id}`} style={{paddingLeft: "10px"}}>
                <ListGroupItem className="spaced">
                    {identifier}
                </ListGroupItem>
            </LinkContainer>
        );
    }
}

const mapDispatchToProps = dispatch => ({

    onClose: () => {
        dispatch(push("/administration/users"));
    },

    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(editUser(userId, {primary_group: groupId}));
    },

    onSetUserRole: (userId, isAdmin) => {
        dispatch(editUser(userId, {administrator: isAdmin}));
    }

});

export default connect(null, mapDispatchToProps)(UserItem);
