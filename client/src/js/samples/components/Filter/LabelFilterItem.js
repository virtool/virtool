import React from "react";
import styled from "styled-components";
import { boxShadow } from "../../../app/theme";
import { Icon } from "../../../base";
import { StyledSampleLabel } from "../Label";

const StyledLabelFilterItem = styled(StyledSampleLabel)`
    ${props => props.pressed && `border-color: ${props.theme.color.blue};`};
    box-shadow: ${props =>
        props.pressed ? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" : "none"};
    cursor: pointer;

    :focus {
        border-color: ${props => props.theme.color.blueLight}
        outline: none;
    }
`;

export const LabelFilterItem = ({ color, id, name, pressed, onClick }) => (
    <StyledLabelFilterItem
        as="button"
        aria-pressed={pressed}
        color={color}
        pressed={pressed}
        onClick={() => onClick(id)}
    >
        <Icon name="circle" />
        {name}
    </StyledLabelFilterItem>
);
