import { get } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

const getButtonBackgroundColor = ({ active, color, theme }) => {
    if (!color || color === "grey") {
        return active ? theme.color.greyLightest : theme.color.white;
    }

    return get(theme, ["color", `${color}${active ? "Dark" : ""}`], theme.white);
};

const getButtonBorderColor = ({ color, theme }) => {
    if (!color || color === "grey") {
        return theme.color.greyLight;
    }

    return theme.color[color];
};

const getButtonForegroundColor = ({ color, theme }) => {
    if (!color || color === "grey") {
        return theme.color.black;
    }

    return theme.color.white;
};

const getButtonHoverColor = ({ color, theme }) => {
    if (color && color !== "grey") {
        return get(theme, ["color", `${color}Dark`], theme.white);
    }

    return theme.color.greyLightest;
};

export const StyledButton = styled.button`
    align-items: center;
    background-color: ${getButtonBackgroundColor};
    background-image: none;
    border: 1px solid ${getButtonBorderColor};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => (props.active ? props.theme.boxShadow.inset : "")};
    color: ${getButtonForegroundColor};
    cursor: pointer;
    display: inline-flex;
    font-weight: 500;
    justify-content: center;
    margin-bottom: 0;
    min-width: 42px;
    min-height: 36px;
    opacity: ${props => (props.disabled ? 0.5 : 1)};
    padding: 0 10px;
    position: relative;
    user-select: none;
    touch-action: manipulation;
    transition: box-shadow 200ms ease-in-out;
    white-space: nowrap;

    i + span {
        margin-left: 5px;
    }

    :focus {
        color: ${getButtonForegroundColor};
    }

    :disabled {
        cursor: not-allowed;
    }

    :not(:disabled):hover {
        background-color: ${getButtonHoverColor};
        border-color: ${getButtonHoverColor};
        color: ${getButtonForegroundColor};
    }

    :not(:disabled)::after {
        border-radius: ${props => props.theme.borderRadius.sm};
        box-shadow: ${props => props.theme.boxShadow.lg};
        content: "";
        height: 100%;
        width: 100%;
        opacity: 0;
        position: absolute;
        transition: opacity 150ms ease, scale 150ms ease;
    }

    :not(:disabled):hover::after {
        opacity: 1;
    }
`;

export const LinkButton = ({ children, color, className, icon, replace, tip, to }) => {
    const button = (
        <StyledButton as={NavLink} className={className} color={color} replace={replace} to={to}>
            {icon && <Icon name={icon} />}
            {children ? <span>{children}</span> : null}
        </StyledButton>
    );

    if (tip) {
        return <Tooltip tip={tip}>{button}</Tooltip>;
    }

    return button;
};

LinkButton.propTypes = {
    children: PropTypes.node,
    color: PropTypes.string,
    className: PropTypes.string,
    icon: PropTypes.string,
    replace: PropTypes.bool,
    tip: PropTypes.string,
    tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"]),
    to: PropTypes.oneOfType([PropTypes.object, PropTypes.string]).isRequired
};

LinkButton.defaultProps = {
    tipPlacement: "top"
};

export const Button = ({ active, children, className, color, disabled, icon, tip, type, onBlur, onClick }) => {
    const button = (
        <StyledButton
            active={active}
            className={className}
            color={color}
            disabled={disabled}
            type={type}
            onBlur={onBlur}
            onClick={onClick}
        >
            {icon && <Icon name={icon} />}
            {children ? <span>{children}</span> : null}
        </StyledButton>
    );

    if (tip) {
        return <Tooltip tip={tip}>{button}</Tooltip>;
    }

    return button;
};

Button.propTypes = {
    active: PropTypes.bool,
    children: PropTypes.node,
    className: PropTypes.string,
    color: PropTypes.string,
    disabled: PropTypes.bool,
    icon: PropTypes.string,
    tip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"]),
    type: PropTypes.oneOf(["button", "submit"]),
    onBlur: PropTypes.func,
    onClick: PropTypes.func
};

Button.defaultProps = {
    color: "grey",
    disabled: false,
    tipPlacement: "top",
    type: "button"
};
