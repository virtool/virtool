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
import { filter } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup, ListGroupItem } from "react-bootstrap";

import { Flex, FlexItem ,Identicon } from "../../base";
import Password from "./Password";
import GroupsPermissions from "./GroupsPermissions";
import PrimaryGroup from "./PrimaryGroup";

const test = () => (
    <div>
        <GroupsPermissions />
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
                <Password {...props} />
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

    const userComponents = filter(props.users, (user) => user.id.match(re)).map((user) =>
        <UserEntry
            key={user.id}
            {...user}
            active={user.id === props.match.params.activeId}
            onSelect={props.onSelect}
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

const mapDispatchToProps = (dispatch) => {
    return {
        onSelect: (userId) => {
            dispatch(selectUser(userId));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(UsersList);

export default Container;
