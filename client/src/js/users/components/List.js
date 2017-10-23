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
import { filter, sortBy } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup, ListGroupItem } from "react-bootstrap";

import { Flex, FlexItem ,Identicon } from "../../base";
import Password from "./Password";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";
import PrimaryGroup from "./PrimaryGroup";

const test = () => (
    <div>
        <PrimaryGroup />
    </div>
);

const UserEntry = (props) => {
    const identifier = (
        <Flex alignItems="center">
            <Identicon size={32} hash={props.identicon} />
            <FlexItem pad={10}>
                {props.id}
            </FlexItem>
        </Flex>
    );

    if (props.active) {
        return (
            <div className="list-group-item spaced" style={{paddingLeft: "10px"}}>
                {identifier}

                <div style={{marginTop: "20px"}}>
                    <label>Change Password</label>
                    <Password {...props} />

                    <label>Groups</label>
                    <UserGroups userId={props.id} memberGroups={props.groups} />

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

const mapStateToProps = (state) => {
    return {
        users: state.users.list,
        filter: state.users.filter
    };
};

const Container = connect(mapStateToProps)(UsersList);

export default Container;
