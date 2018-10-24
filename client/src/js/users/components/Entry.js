import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";
import { get } from "lodash-es";
import { Flex, FlexItem, Identicon, Icon } from "../../base";

export const UserEntry = ({ entry }) => (
  <LinkContainer
    to={`/administration/users/${entry.id}`}
    style={{ paddingLeft: "10px" }}
  >
    <ListGroupItem className="spaced">
      <Flex alignItems="center">
        <Identicon size={32} hash={entry.identicon} />
        <FlexItem pad={10}>{entry.id}</FlexItem>
        <FlexItem pad={10}>
          {entry.administrator ? (
            <Icon name="user-shield" bsStyle="primary" />
          ) : null}
        </FlexItem>
      </Flex>
    </ListGroupItem>
  </LinkContainer>
);

const mapStateToProps = (state, props) => ({
  entry: get(state, `users.list.documents[${props.index}]`, null)
});

export default connect(mapStateToProps)(UserEntry);
