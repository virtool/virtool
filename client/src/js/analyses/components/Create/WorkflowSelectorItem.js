import React, { useCallback } from "react";
import styled from "styled-components";
import { BoxGroupSection, Checkbox } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";

const StyledWorkflowSelectorItem = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
    user-select: none;
`;

export const WorkflowSelectorItem = ({ active, workflow, onSelect }) => {
    const handleClick = useCallback(() => onSelect(workflow), [workflow, onSelect]);
    return (
        <StyledWorkflowSelectorItem active={active} onClick={handleClick}>
            <Checkbox checked={active} /> {getTaskDisplayName(workflow)}
        </StyledWorkflowSelectorItem>
    );
};
