import React from "react";
import styled from "styled-components";
import { Icon } from "./Icon";

export const UnstyledAlert = ({ children, className, color, icon }) => {
    return (
        <div className={className} color={color}>
            {icon ? <Icon name={icon} /> : null}
            {children}
        </div>
    );
};

export const Alert = styled(UnstyledAlert)`
    align-items: ${props => (props.level ? "center" : "normal")};
    border: 1px solid grey;
    border-left-width: 4px;
    display: ${props => (props.block ? "block" : "flex")};
    margin-bottom: 16px;
    padding: 15px;

    i.fas:first-child {
        color: currentColor;
        padding-right: 5px;
    }
`;

export const DangerAlert = styled(Alert)`
    background-color: #fff5f5;
    border-color: #feb2b2;
    color: #c53030;
`;

export const InfoAlert = styled(Alert)`
    background-color: #e9d8fd;
    border-color: #b794f4;
    color: #553c9a;
`;

export const WarningAlert = styled(Alert)`
    border-color: #fbd38d;
    background-color: #fffaf0;
    color: #c05621;

    a:last-child {
        margin-left: auto;
    }
`;
