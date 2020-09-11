import React, { useCallback } from "react";
import styled from "styled-components";
import { Checkbox, SelectBoxGroupSection } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";

const StyledWorkflowSelectorItem = styled(SelectBoxGroupSection)`
    user-select: none;
`;

export const WorkflowSelectorItem = ({ active, workflow, onSelect }) => {
    const handleClick = useCallback(() => onSelect(workflow), [workflow, onSelect]);
    return (
        <StyledWorkflowSelectorItem active={active} onClick={handleClick}>
            <Checkbox checked={active} label={getTaskDisplayName(workflow)} />
        </StyledWorkflowSelectorItem>
    );
};
