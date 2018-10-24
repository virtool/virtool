import React from "react";
import { includes, map, remove } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { ListGroupItem, Checkbox, NoneFound } from "../../base";
import { editUser } from "../actions";

export class UserGroup extends React.Component {
  handleClick = () => {
    const { userGroups, groupId, userId } = this.props;
    let newGroups;

    if (this.props.toggled) {
      newGroups = remove(userGroups, group => group !== groupId);
      return this.props.onEditGroup(userId, newGroups);
    }

    newGroups = userGroups.slice();
    newGroups.push(groupId);
    this.props.onEditGroup(userId, newGroups);
  };

  render() {
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

export const UserGroups = ({
  allGroups,
  memberGroups,
  onEditGroup,
  userId
}) => {
  const groupComponents = map(allGroups, groupId => (
    <UserGroup
      key={groupId}
      groupId={groupId}
      userGroups={memberGroups}
      userId={userId}
      toggled={includes(memberGroups, groupId)}
      onEditGroup={onEditGroup}
    />
  ));

  if (!groupComponents.length) {
    return <NoneFound noun="groups" />;
  }

  return (
    <Panel>
      <Panel.Body>
        <Row>{groupComponents}</Row>
      </Panel.Body>
    </Panel>
  );
};

const mapStateToProps = state => ({
  allGroups: map(state.groups.list, "id")
});

const mapDispatchToProps = dispatch => ({
  onEditGroup: (userId, groups) => {
    dispatch(editUser(userId, { groups }));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserGroups);
