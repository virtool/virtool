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
import { find } from "lodash";
import { connect } from "react-redux";
import { capitalize, includes} from "lodash";
import { Row, Col, Panel, ListGroup } from "react-bootstrap";
import { ListGroupItem, Checkbox, Icon, Help } from "virtool/js/components/Base";

import { addUserToGroup, removeUserFromGroup } from "../actions";
import Permissions from "../../groups/components/Permissions";

const GroupsPermissions = (props) => {

    const groupComponents = props.allGroups.map(groupId => {

        const toggled = includes(props.memberGroups, groupId);

        return (
            <ListGroupItem
                key={groupId}
                onClick={() => (toggled ? props.removeFromGroup: props.addToGroup)(props.userId, groupId)}
                disabled={groupId === "administrator" && props.userId === props.accountUserId}
            >
                {capitalize(groupId)}
                <Checkbox checked={toggled} pullRight/>
            </ListGroupItem>
        );
    });

    return (
        <Row>
            <Col xs={12} md={5}>
                <h5><Icon name="users" /> <strong>Groups</strong></h5>
                <Panel>
                    <ListGroup fill style={{borderBottom: "1px solid #dddddd"}}>
                        {groupComponents}
                    </ListGroup>
                </Panel>
            </Col>
            <Col xs={12} md={7}>
                <h5>
                    <Icon name="key" /> <strong>Permissions</strong>
                    <Help pullRight>
                        Users inherit permissions from groups they belong to. Change a user's groups to modify
                        their permissions.
                    </Help>
                </h5>
                <Permissions permissions={props.permissions} />
            </Col>
        </Row>
    );
};

GroupsPermissions.propTypes = {
    userId: React.PropTypes.string,
    accountUserId: React.PropTypes.string,
    allGroups: React.PropTypes.array,
    memberGroups: React.PropTypes.array,
    permissions: React.PropTypes.object,
    addToGroup: React.PropTypes.func,
    removeFromGroup: React.PropTypes.func
};

const mapStateToProps = (state) => {

    const activeData = find(state.users.list, {id: state.users.activeId});

    return {
        userId: activeData.id,
        accountUserId: state.account.id,
        allGroups: state.groups.list.map(group => group.id),
        memberGroups: activeData.groups,
        permissions: activeData.permissions
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

const Container = connect(mapStateToProps, mapDispatchToProps)(GroupsPermissions);

export default Container;
