import React from "react";
import { connect } from "react-redux";
import { get } from "lodash-es";
import styled from "styled-components";
import { FlexItem, Identicon, Icon, LinkBox } from "../../base";

const StyledUserItem = styled.div`
    display: flex;
    align-items: center;
`;

export const UserItem = ({ id, identicon, administrator }) => (
    <LinkBox to={`/administration/users/${id}`}>
        <StyledUserItem>
            <Identicon size={32} hash={identicon} />
            <FlexItem pad={10}>{id}</FlexItem>
            <FlexItem pad={10}>{administrator ? <Icon name="user-shield" bsStyle="primary" /> : null}</FlexItem>
        </StyledUserItem>
    </LinkBox>
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
