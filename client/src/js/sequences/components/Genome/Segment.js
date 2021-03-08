import React from "react";
import styled from "styled-components";
import { fontWeight } from "../../../app/theme";
import { Icon } from "../../../base";

const SequenceSegmentRequired = styled.span`
    align-items: center;
    display: flex;
    margin-left: auto;

    span {
        margin-left: 4px;
    }
`;

const StyledSequenceSegment = styled.div`
    align-items: center;
    display: flex;
    font-weight: ${fontWeight.thick};
    width: 100%;
`;

export const SequenceSegment = ({ name, required }) => (
    <StyledSequenceSegment>
        <span>{name}</span>

        {required && (
            <SequenceSegmentRequired>
                <Icon name="exclamation-circle" />
                <span>Required</span>
            </SequenceSegmentRequired>
        )}
    </StyledSequenceSegment>
);
