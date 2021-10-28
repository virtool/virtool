import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Icon, InitialIcon, Label, LinkBox } from "../../base";

const StyledUserItem = styled(LinkBox)`
    display: flex;
    align-items: center;

    strong {
        font-size: ${getFontSize("lg")};
        font-weight: ${getFontWeight("thick")};
        padding-left: 10px;
    }

    ${Label} {
        font-size: ${getFontSize("md")};
        margin-left: auto;
    }
`;

export const UserItem = ({ id, handle, administrator }) => (
    <StyledUserItem to={`/administration/users/${id}`}>
        <InitialIcon size="md" handle={handle} />
        <strong>{handle}</strong>
        {administrator && (
            <Label color="purple">
                <Icon name="user-shield" /> Administrator
            </Label>
        )}
    </StyledUserItem>
);

export const mapStateToProps = (state, ownProps) => {
    const { id, handle, administrator } = get(state, `users.documents[${ownProps.index}]`, null);

    return {
        id,
        handle,
        administrator
    };
};

export default connect(mapStateToProps)(UserItem);
