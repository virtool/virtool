import { CustomCheckboxContainer, CustomCheckboxInput } from "@reach/checkbox";
import "@reach/checkbox/styles.css";
import React from "react";
import styled from "styled-components";
import { Icon } from "./Icon";

const CheckboxContainer = styled.div`
    display: inline-flex;
`;

const CheckIcon = styled(Icon)`
    font-size: 11px;
    color: ${props => (props.checked ? "white" : "grey")};
`;

const CheckboxLabel = styled.span`
    vertical-align: bottom;
    cursor: pointer;
    margin-left: 5px;
`;

export const StyledCheckbox = styled(CustomCheckboxContainer)`
    align-items: center;
    background-color: ${props => (props.checked ? "teal" : "white")};
    border: ${props => (props.checked ? "none" : `2px solid ${props.theme.color.greyDark}`)};
    border-radius: 50%;
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    height: 20px;
    margin-right: 0;
    opacity: ${props => (props.checked ? 1 : 0.5)};
    width: 20px;
`;

const CheckboxInput = styled(CustomCheckboxInput)`
    display: none;
`;

export const Checkbox = ({ checked, disabled, label, onClick }) => {
    return (
        <CheckboxContainer>
            <StyledCheckbox checked={checked} onClick={disabled ? null : onClick}>
                <CheckIcon checked={checked} name="check" />
                <CheckboxInput />
            </StyledCheckbox>

            {label ? <CheckboxLabel onClick={disabled ? null : onClick}>{label}</CheckboxLabel> : null}
        </CheckboxContainer>
    );
};
