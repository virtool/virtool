import { get } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { getColor } from "../app/theme";
import { Icon } from "./Icon";

export const getAlertBackgroundColor = ({ color, theme }) =>
    get(theme, ["color", `${color}Lightest`], theme.color.greyLightest);

export const getTextColor = ({ color, theme }) => get(theme, ["color", `${color}Dark`], theme.color.greyDark);

const StyledAlert = styled.div`
    align-items: ${props => (props.level ? "center" : "normal")};
    background-color: ${getAlertBackgroundColor};
    border: 1px solid ${getColor};
    border-radius: ${props => props.theme.borderRadius.lg};
    border-left-width: 4px;
    color: ${getTextColor};
    display: ${props => (props.block ? "block" : "flex")};
    margin-bottom: 16px;
    padding: 15px;

    i.fas:first-child {
        color: currentColor;
        padding-right: 5px;
    }
`;

export const _Alert = ({ block, children, className, color, icon, level }) => (
    <StyledAlert block={block} className={className} color={color} level={level}>
        {icon ? <Icon name={icon} /> : null}
        {children}
    </StyledAlert>
);

export const Alert = styled(_Alert)``;
