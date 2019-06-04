import React, { useCallback } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { BoxGroup, Icon, Identicon, Flex, FlexItem } from "../../../base";
import GroupIcon from "../../../groups/components/GroupIcon";

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

const MemberItem = ({ canModify, id, identicon, onEdit, onRemove }) => {
    const handleEdit = useCallback(() => onEdit(id), [id]);
    const handleRemove = useCallback(() => onRemove(id), [id]);

    let icons;

    if (canModify) {
        icons = (
            <FlexItem grow={1} shrink={1}>
                <Flex alignItems="center" className="pull-right">
                    <Icon name="edit" bsStyle="warning" tip="Modify" onClick={handleEdit} />
                    <FlexItem pad>
                        <Icon name="trash" bsStyle="danger" tip="Remove" onClick={handleRemove} />
                    </FlexItem>
                </Flex>
            </FlexItem>
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
