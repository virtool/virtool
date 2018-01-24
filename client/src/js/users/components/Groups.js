import React from "react";
import { includes, map } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { ListGroupItem, Checkbox } from "../../base";

import { addUserToGroup, removeUserFromGroup } from "../actions";

class UserGroup extends React.Component {

    handleClick = () => {
        const { groupId, userId } = this.props;

        if (this.props.toggled) {
            return this.props.removeFromGroup(userId, groupId);
        }

        this.props.addToGroup(userId, groupId);
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

const UserGroups = ({ accountUserId, addToGroup, allGroups, memberGroups, removeFromGroup, userId }) => {

    const groupComponents = map(allGroups, groupId =>
        <UserGroup
            key={groupId}
            groupId={groupId}
            accountUserId={accountUserId}
            disabled={groupId === "administrator" && userId === accountUserId}
            toggled={includes(memberGroups, groupId)}
            onAddToGroup={addToGroup}
            onRemoveFromGroup={removeFromGroup}
        />
    );

    return (
        <Panel>
            <Row>
                {groupComponents}
            </Row>
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
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(UserGroups);

export default Container;
