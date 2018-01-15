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
import { capitalize, filter, sortBy } from "lodash";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup, ListGroupItem } from "react-bootstrap";

import { setPrimaryGroup } from "../actions";
import { Flex, FlexItem, Identicon, Input } from "../../base";
import Password from "./Password";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";

const UserEntry = (props) => {
    let closeButton;

    if (props.active) {
        closeButton = (
            <button type="button" className="close" onClick={props.onClose}>
                <span>×</span>
            </button>
        );
    }


    const identifier = (
        <Flex alignItems="center">
            <Identicon size={32} hash={props.identicon} />
            <FlexItem pad={10}>
                {props.id}
            </FlexItem>
            <FlexItem grow={1} shrink={1}>
                {closeButton}
            </FlexItem>
        </Flex>
    );

    if (props.active) {
        const groupOptions = props.groups.map(group =>
            <option key={group} value={group}>{capitalize(group)}</option>
        );

        return (
            <div className="list-group-item spaced" style={{paddingLeft: "10px"}}>
                {identifier}

                <div style={{marginTop: "20px"}}>
                    <label>Change Password</label>
                    <Password {...props} />

                    <label>Groups</label>
                    <UserGroups userId={props.id} memberGroups={props.groups} />

                    <label>Primary Group</label>
                    <Input
                        type="select"
                        value={props.primary_group}
                        onChange={(e) => props.onSetPrimaryGroup(props.id, e.target.value)}
                    >
                        <option key="none" value="none">None</option>
                        {groupOptions}
                    </Input>

                    <Flex alignItems="center" justifyContent="space-between">
                        <label>Permissions</label>
                        <small className="text-muted">Change group membership to modify permissions</small>
                    </Flex>
                    <UserPermissions permissions={props.permissions} />
                </div>
            </div>
        );
    }

    return (
        <LinkContainer to={`/settings/users/${props.id}`} style={{paddingLeft: "10px"}}>
            <ListGroupItem className="spaced">
                {identifier}
            </ListGroupItem>
        </LinkContainer>
    );
};

const UsersList = (props) => {

    const re = new RegExp(props.filter);

    const userComponents = sortBy(filter(props.users, user => user.id.match(re)), "id").map(user =>
        <UserEntry
            key={user.id}
            {...user}
            active={user.id === props.match.params.activeId}
            onSetPrimaryGroup={props.onSetPrimaryGroup}
            onClose={props.onClose}
        />
    );

    return (
        <div>
            <ListGroup className="spaced">
                {userComponents}
            </ListGroup>
        </div>
    );
};

const mapStateToProps = state => ({
    users: state.users.list,
    filter: state.users.filter
});

const mapDispatchToProps = dispatch => ({

    onClose: () => {
        dispatch(push("/settings/users"));
    },

    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(setPrimaryGroup(userId, groupId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(UsersList);

export default Container;
