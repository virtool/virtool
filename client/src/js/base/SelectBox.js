import styled from "styled-components";
import { Box } from "./Box";
import React from "react";

export const StyledSelectBox = styled(Box)`
    border: 1px ${props => (props.active ? props.theme.color.blue : props.theme.color.greyLight)} solid;
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => (props.active ? props.theme.boxShadow.inset : "none")};
    background: white;
    width: 100%;
    text-align: left;
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
    let buttonType = props.type ? props.type : "button";
    return (
        <StyledSelectBox {...props} type={buttonType} as="button">
            {props.children}
        </StyledSelectBox>
    );
};
