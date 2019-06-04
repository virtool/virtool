import React, { useCallback } from "react";
import styled from "styled-components";
import { Checkbox } from "../../../base";

const descriptions = {
    build: "Can build new indexes for the reference.",
    modify: "Can modify reference properties and settings.",
    modify_otu: "Can modify OTU records in the reference.",
    remove: "Can remove the reference from Virtool."
};

export const MemberRightCheckbox = styled(Checkbox)`
    margin-top: 1px;
`;

const MemberRightDescription = styled.div`
    display: flex;
    flex-direction: column;
    padding-left: 10px;

    small {
        padding-top: 3px;
    }
`;

const StyledMemberRight = styled.div`
    align-items: flex-start;
    display: flex;

    &:not(:last-child) {
        margin-bottom: 15px;
    }
`;

export const MemberRight = ({ right, enabled, onToggle }) => {
    const handleClick = useCallback(() => onToggle(right, !enabled), [enabled]);

    return (
        <StyledMemberRight>
            <MemberRightCheckbox key={right} checked={enabled} onClick={handleClick} />
            <MemberRightDescription>
                <strong>{right}</strong>
                <small>{descriptions[right]}</small>
            </MemberRightDescription>
        </StyledMemberRight>
    );
};
