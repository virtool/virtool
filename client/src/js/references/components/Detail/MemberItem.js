import PropTypes from "prop-types";
import React, { useCallback } from "react";
import styled from "styled-components";
import { BoxGroup, FlexItem, Icon, Identicon } from "../../../base";
import GroupIcon from "../../../groups/components/Icon";

const StyledMemberItem = styled(BoxGroup.Section)`
    align-items: center;
    display: flex;
`;

const MemberItemIcon = ({ identicon }) => {
    if (identicon) {
        return (
            <FlexItem grow={0} shrink={0} style={{ paddingRight: "8px" }}>
                <Identicon size={24} hash={identicon} />
            </FlexItem>
        );
    }

    return (
        <FlexItem grow={0} shrink={0} style={{ paddingRight: "8px" }}>
            <GroupIcon />
        </FlexItem>
    );
};

const MemberItemIcons = styled.span`
    align-items: center;
    display: flex;
    margin-left: auto;

    i {
        margin-left: 5px;
    }
`;

const MemberItem = ({ canModify, id, identicon, onEdit, onRemove }) => {
    const handleEdit = useCallback(() => onEdit(id), [id]);
    const handleRemove = useCallback(() => onRemove(id), [id]);

    let icons;

    if (canModify) {
        icons = (
            <MemberItemIcons>
                <Icon name="edit" color="orange" tip="Modify" onClick={handleEdit} />
                <Icon name="trash" color="red" tip="Remove" onClick={handleRemove} />
            </MemberItemIcons>
        );
    }

    return (
        <StyledMemberItem>
            <MemberItemIcon identicon={identicon} />
            {id}
            {icons}
        </StyledMemberItem>
    );
};

MemberItem.propTypes = {
    canModify: PropTypes.bool.isRequired,
    id: PropTypes.string.isRequired,
    identicon: PropTypes.string,
    onEdit: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired
};

export default MemberItem;
