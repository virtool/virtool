import { get } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { getColor, getFontWeight } from "../app/theme";
import { Icon } from "./Icon";

export const getAlertBackgroundColor = ({ color, theme }) =>
    get(theme, ["color", `${color}Lightest`], theme.color.greyLightest);

export const getAlertTextColor = ({ color, theme }) => get(theme, ["color", `${color}Dark`], theme.color.greyDarkest);

const AlertInner = styled.div`
    align-items: ${props => (props.level ? "center" : "normal")};
    border-left: 10px solid ${getColor};
    display: ${props => (props.block ? "block" : "flex")};
    padding: 15px;
`;

const StyledAlert = styled.div`
    background-color: ${getAlertBackgroundColor};
    border-radius: ${props => props.theme.borderRadius.md};
    border: none;
    box-shadow: ${props => props.theme.boxShadow.sm};
    color: ${getAlertTextColor};
    font-weight: ${getFontWeight("thick")};
    margin-bottom: 16px;
    overflow: hidden;

    i.fas:first-child {
        color: currentColor;
        padding-right: 5px;
    }
`;

export const _Alert = ({ block, children, className, color, icon, level }) => (
    <StyledAlert color={color}>
        <AlertInner className={className} block={block} color={color} level={level}>
            {icon ? <Icon name={icon} /> : null}
            {children}
        </AlertInner>
    </StyledAlert>
);

export const Alert = styled(_Alert)``;
