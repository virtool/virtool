import React from "react";
import { includes, map } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { ListGroupItem, Checkbox } from "../../base";

import { addUserToGroup, removeUserFromGroup, listUsers } from "../actions";

class UserGroup extends React.Component {

    componentWillReceiveProps (nextProps) {
        if (nextProps.toggled !== this.props.toggled) {
            this.props.onListUsers();
        }
    }

    handleClick = () => {
        const { groupId, userId } = this.props;

        if (this.props.toggled) {
            return this.props.onRemoveFromGroup(userId, groupId);
        }

        this.props.onAddToGroup(userId, groupId);

    };

    render () {
        return (
            <Col xs={12} md={4} key={this.props.groupId}>
                <ListGroupItem
                    className="text-capitalize"
                    onClick={this.handleClick}
                    disabled={this.props.disabled}
                >
                    {this.props.groupId}
                    <Checkbox checked={this.props.toggled} pullRight />
                </ListGroupItem>
            </Col>
        );
    }
}

const UserGroups = ({ accountUserId, addToGroup, allGroups, memberGroups, removeFromGroup, userId, list }) => {

    const groupComponents = map(allGroups, groupId =>
        <UserGroup
            key={groupId}
            groupId={groupId}
            accountUserId={accountUserId}
            userId={userId}
            disabled={groupId === "administrator" && userId === accountUserId}
            toggled={includes(memberGroups, groupId)}
            onAddToGroup={addToGroup}
            onRemoveFromGroup={removeFromGroup}
            onListUsers={list}
        />
    );

    return (
        <Panel>
            <Panel.Body>
                <Row>
                    {groupComponents}
                </Row>
            </Panel.Body>
        </Panel>
    );
};

const mapStateToProps = state => ({
    accountUserId: state.account.id,
    allGroups: map(state.groups.list, "id")
});

const mapDispatchToProps = dispatch => ({

    addToGroup: (userId, groupId) => {
        dispatch(addUserToGroup(userId, groupId));
    },

    removeFromGroup: (userId, groupId) => {
        dispatch(removeUserFromGroup(userId, groupId));
    },

    list: () => {
        dispatch(listUsers());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(UserGroups);
