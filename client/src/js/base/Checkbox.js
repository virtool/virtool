import { CustomCheckboxContainer, CustomCheckboxInput } from "@reach/checkbox";
import "@reach/checkbox/styles.css";
import React from "react";
import styled from "styled-components";
import { Icon } from "./Icon";

const getBackgroundColor = ({ checked, theme }) => theme.color[checked ? "primary" : "transparent"];

const getBorder = ({ checked, theme }) => (checked ? "none" : `2px solid ${theme.color.greyDark}`);

const getColor = ({ checked, theme }) => theme.color[checked ? "white" : "grey"];

const CheckboxContainer = styled.div`
    display: inline-flex;
`;

const CheckboxInput = styled(CustomCheckboxInput)`
    display: none;
`;

const CheckboxLabel = styled.span`
    vertical-align: bottom;
    cursor: pointer;
    margin-left: 5px;
`;

export const StyledCheckbox = styled(CustomCheckboxContainer)`
    align-items: center;
    background-color: ${getBackgroundColor};
    border: ${getBorder};
    border-radius: 2px;
    color: ${getColor};
    cursor: pointer;
    display: inline-flex;
    font-size: 11px;
    height: 20px;
    justify-content: center;
    margin-right: 0;
    opacity: ${props => (props.checked ? 1 : 0.5)};
    transition: opacity 100ms ease;
    width: 20px;
`;

export const Checkbox = ({ checked, disabled, label, onClick }) => (
    <CheckboxContainer>
        <StyledCheckbox checked={checked} onClick={disabled ? null : onClick}>
            <Icon checked={checked} name="check" />
            <CheckboxInput />
        </StyledCheckbox>

        {label ? <CheckboxLabel onClick={disabled ? null : onClick}>{label}</CheckboxLabel> : null}
    </CheckboxContainer>
);
