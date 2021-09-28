import styled from "styled-components";
import { Box } from "./Box";
import { Button } from "./Button";
import React from "react";

export const SelectButton = styled.button`
    border: 1px ${props => (props.active ? props.theme.color.blue : props.theme.color.greyLight)} solid;
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => (props.active ? props.theme.boxShadow.inset : "none")};
    background: white;
    width: 100%;
    text-align: center;
    white-space: normal;

    div {
        font-weight: ${props => props.theme.fontWeight.thick};
        padding-bottom: 5px;
    }

    span {
        color: ${props => props.theme.color.greyDarkest};
        padding-top: 5px;
    }
`;

export const SelectBox = props => {
    return (
        <SelectButton {...props} type={"button"}>
            {props.children}
        </SelectButton>
    );
};
