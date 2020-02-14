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
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    align-items: center;

    width: 19px;
    height: 19px;

    border-radius: 50%;

    border: ${props => (props.checked ? "none" : "1px solid black")};
    opacity: ${props => (props.checked ? 1 : 0.5)};
    background-color: ${props => (props.checked ? "teal" : "white")};
`;

const CheckboxInput = styled(CustomCheckboxInput)`
    display: none;
`;

export const Checkbox = props => {
    return (
        <CheckboxContainer>
            <StyledCheckbox checked={props.checked} onClick={props.disabled ? null : props.onClick}>
                <CheckIcon checked={props.checked} name="check" />

                <CheckboxInput />
            </StyledCheckbox>
            {props.label ? (
                <CheckboxLabel onClick={props.disabled ? null : props.onClick}>{props.label}</CheckboxLabel>
            ) : null}
        </CheckboxContainer>
    );
};
