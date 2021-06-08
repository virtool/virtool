import React from "react";
import styled from "styled-components";
import { getRing } from "../../../app/theme";
import { Icon } from "../../../base";
import { StyledSampleLabel } from "../Label";

const StyledLabelFilterItem = styled(StyledSampleLabel)`
    ${props => props.pressed && `border-color: ${props.theme.color.blue};`};
    box-shadow: ${props => (props.pressed ? getRing("blueLight")(props) : "none")};
    cursor: pointer;
    margin: 4px 0;
  
      :not(:last-child) {
        margin-right: 8px;
      }

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
