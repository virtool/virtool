import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";
import { get } from "lodash-es";
import { Flex, FlexItem, Identicon, Icon } from "../../base";

export const UserItem = ({ document }) => (
    <LinkContainer to={`/administration/users/${document.id}`} style={{ paddingLeft: "10px" }}>
        <ListGroupItem className="spaced">
            <Flex alignItems="center">
                <Identicon size={32} hash={document.identicon} />
                <FlexItem pad={10}>{document.id}</FlexItem>
                <FlexItem pad={10}>
                    {document.administrator ? <Icon name="user-shield" bsStyle="primary" /> : null}
                </FlexItem>
            </Flex>
        </ListGroupItem>
    </LinkContainer>
);

const mapStateToProps = (state, props) => ({
    document: get(state, `users.documents[${props.index}]`, null)
});

export default connect(mapStateToProps)(UserItem);
