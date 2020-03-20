import React, { useCallback } from "react";
import styled from "styled-components";
import { BoxGroupSection, Icon } from "../../../../base";

const TargetItemHeader = styled.h3`
    align-items: center;
    display: flex;
    font-size: 14px;
    font-weight: normal;
    margin: 3px 0 6px;

    span {
        margin-left: auto;

        i:not(first-child) {
            margin-left: 3px;
        }
    }
`;

const TargetItemDescription = styled.p`
    font-style: ${props => (props.description ? "normal" : "italic")};
    margin: 0;
`;

export const TargetItem = ({ canModify, description, name, onEdit, onRemove }) => {
    const handleEdit = useCallback(() => onEdit(name), [name]);
    const handleRemove = useCallback(() => onRemove(name), [name]);

    let icons;

    if (canModify) {
        icons = (
            <span>
                <Icon name="edit" color="orange" tip="Modify" onClick={handleEdit} />
                <Icon name="trash" color="red" tip="Remove" onClick={handleRemove} />
            </span>
        );
    }

    return (
        <BoxGroupSection>
            <TargetItemHeader>
                {name}
                {icons}
            </TargetItemHeader>
            <TargetItemDescription description={description}>{description || "No description"}</TargetItemDescription>
        </BoxGroupSection>
    );
};
