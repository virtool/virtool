import PropTypes from "prop-types";
import React, { useCallback } from "react";
import styled from "styled-components";
import { BoxGroupSection, FlexItem, Icon } from "../../../base";
import GroupIcon from "../../../groups/components/Icon";

const StyledMemberItem = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
`;

const MemberItemIcon = () => {
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

const MemberItem = ({ canModify, id, onEdit, onRemove }) => {
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
            <MemberItemIcon />
            {id}
            {icons}
        </StyledMemberItem>
    );
};

MemberItem.propTypes = {
    canModify: PropTypes.bool.isRequired,
    id: PropTypes.string.isRequired,
    onEdit: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired
};

export default MemberItem;
