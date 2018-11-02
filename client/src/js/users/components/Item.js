import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";
import { get } from "lodash-es";
import { Flex, FlexItem, Identicon, Icon } from "../../base";

export const UserItem = ({ id, identicon, administrator }) => (
    <LinkContainer to={`/administration/users/${id}`} style={{ paddingLeft: "10px" }}>
        <ListGroupItem className="spaced">
            <Flex alignItems="center">
                <Identicon size={32} hash={identicon} />
                <FlexItem pad={10}>{id}</FlexItem>
                <FlexItem pad={10}>{administrator ? <Icon name="user-shield" bsStyle="primary" /> : null}</FlexItem>
            </Flex>
        </ListGroupItem>
    </LinkContainer>
);

export const mapStateToProps = (state, ownProps) => {
    const { id, identicon, administrator } = get(state, `users.documents[${ownProps.index}]`, null);

    return {
      id,
      identicon,
      administrator
    };
};

export default connect(mapStateToProps)(UserItem);
