import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Icon, Flex, FlexItem } from "../../../../base";

const NameIcon = styled.div`
    display: flex;
    justify-content: space-between;
`;

const TargetIcon = ({ onEdit, onRemove }) => (
    <FlexItem grow={1} shrink={1}>
        <Flex alignItems="center" className="pull-right">
            <Icon name="edit" bsStyle="warning" tip="Modify" onClick={onEdit} />
            <FlexItem pad>
                <Icon name="trash" bsStyle="danger" tip="Remove" onClick={onRemove} />
            </FlexItem>
        </Flex>
    </FlexItem>
);

export const TargetItem = ({ name, description, onEdit, onRemove }) => {
    return (
        <BoxGroupSection>
            <NameIcon>
                {name}
                <TargetIcon onEdit={onEdit} onRemove={onRemove} />
            </NameIcon>
            {description}
        </BoxGroupSection>
    );
};
