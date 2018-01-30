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

import { setPrimaryGroup } from "../actions";
import { Flex, FlexItem, Identicon, Input } from "../../base";
import Password from "./Password";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";


export class UserItem extends React.Component {

    handleSetPrimaryGroup = (e) => {
        this.props.onSetPrimaryGroup(this.props.id, e.target.value);
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

            return (
                <div className="list-group-item spaced" style={{paddingLeft: "10px"}}>

                    {identifier}

                    <div style={{marginTop: "20px"}}>
                        <label>Change Password</label>
                        <Password {...this.props} />

                        <label>Groups</label>
                        <UserGroups userId={this.props.id} memberGroups={this.props.groups} />

                        <label>Primary Group</label>
                        <Input
                            type="select"
                            value={this.props.primary_group}
                            onChange={this.handleSetPrimaryGroup}
                        >
                            <option key="none" value="none">None</option>
                            {groupOptions}
                        </Input>

                        <Flex alignItems="center" justifyContent="space-between">
                            <label>Permissions</label>
                            <small className="text-muted">Change group membership to modify permissions</small>
                        </Flex>
                        <UserPermissions permissions={this.props.permissions} />
                    </div>
                </div>
            );
        }

        return (
            <LinkContainer to={`/settings/users/${this.props.id}`} style={{paddingLeft: "10px"}}>
                <ListGroupItem className="spaced">
                    {identifier}
                </ListGroupItem>
            </LinkContainer>
        );
    }
}

const mapStateToProps = state => ({
    users: state.users.list
});

const mapDispatchToProps = dispatch => ({

    onClose: () => {
        dispatch(push("/settings/users"));
    },

    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(setPrimaryGroup(userId, groupId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(UserItem);
