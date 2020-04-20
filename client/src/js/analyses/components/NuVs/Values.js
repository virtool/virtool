import React from "react";
import styled from "styled-components";

const StyledNuVsValues = styled.span`
    font-size: ${props => props.theme.fontSize.sm};
    font-weight: bold;
    padding-top: 3px;

    span:first-child {
        color: ${props => props.theme.color.green};
    }

    span:last-child {
        color: ${props => props.theme.color.red};
    }
`;

export const NuVsValues = ({ e, orfCount }) => (
    <StyledNuVsValues>
        <span>{orfCount} ORFs</span>
        <span> / </span>
        <span>E = {e}</span>
    </StyledNuVsValues>
);
