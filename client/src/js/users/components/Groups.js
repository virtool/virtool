/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports GroupsPermissions
 */

import React from "react";
import { connect } from "react-redux";
import { includes} from "lodash";
import { Row, Col, Panel, ListGroup } from "react-bootstrap";
import { ListGroupItem, Checkbox, Icon, Help } from "../../base";

import { addUserToGroup, removeUserFromGroup } from "../actions";

const UserGroups = (props) => {

    const groupComponents = props.allGroups.map(groupId => {

        const toggled = includes(props.memberGroups, groupId);

        return (
            <Col xs={12} md={4} key={groupId}>
                <ListGroupItem
                    className="text-capitalize"
                    onClick={() => (toggled ? props.removeFromGroup: props.addToGroup)(props.userId, groupId)}
                    disabled={groupId === "administrator" && props.userId === props.accountUserId}
                >
                    {groupId}
                    <Checkbox checked={toggled} pullRight />
                </ListGroupItem>
            </Col>
        );
    });

    return (
        <Panel>
            <Row>
                {groupComponents}
            </Row>
        </Panel>
    );
};

const mapStateToProps = (state) => {
    return {
        accountUserId: state.account.id,
        allGroups: state.groups.list.map(group => group.id)
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        addToGroup: (userId, groupId) => {
            dispatch(addUserToGroup(userId, groupId));
        },

        removeFromGroup: (userId, groupId) => {
            dispatch(removeUserFromGroup(userId, groupId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(UserGroups);

export default Container;
