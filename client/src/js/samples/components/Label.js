import React from "react";
import styled from "styled-components";
import { borderRadius, getBorder } from "../../app/theme";
import { Icon } from "../../base";

const StyledSampleLabel = styled.span`
    align-items: center;
    border: ${getBorder};
    border-radius: ${borderRadius.md};
    display: inline-flex;
    padding: 4px 8px;

    i.fas {
        color: ${props => props.color};
        margin-right: 5px;
    }
`;

export const SampleLabel = ({ color, name }) => (
    <StyledSampleLabel color={color}>
        <Icon name="circle" />
        {name}
    </StyledSampleLabel>
);
