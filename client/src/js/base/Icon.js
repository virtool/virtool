import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { capitalize, get } from "lodash-es";
import { Link } from "react-router-dom";
import styled, { css } from "styled-components";
import { Tooltip } from "./Tooltip";

const getIconColor = ({ color, theme, shade = "dark" }) =>
    get(theme, ["color", `${color}${capitalize(shade)}`], "inherit");

const fixedWidth = css`
    width: 8px;
    text-align: center;
    display: inline-block;
`;

const StyledIcon = styled.i`
    color: ${getIconColor};
    ${props => (props.hoverable || props.onClick ? "cursor: pointer;" : "")};
    opacity: ${props => (props.hoverable || props.onClick ? 0.7 : 1)};

    ${props => (props.fixedWidth ? fixedWidth : "")};

    :hover {
        opacity: 1;
    }
`;

export const Icon = ({ hoverable, style, ...props }) => {
    const handleClick = useCallback(e => {
        props.onClick(e);
    }, []);

    const className = `${props.className ? props.className + " " : ""} ${props.faStyle} fa-${props.name}`;

    const icon = (
        <StyledIcon
            className={className}
            fixedWidth={props.fixedWidth}
            hoverable={hoverable}
            style={style}
            onClick={props.onClick ? handleClick : null}
            color={props.color}
            shade={props.shade}
        />
    );

    if (props.tip) {
        return (
            <Tooltip position={props.tipPlacement || "top"} tip={props.tip}>
                {icon}
            </Tooltip>
        );
    }

    return icon;
};

Icon.propTypes = {
    color: PropTypes.oneOf(["blue", "green", "grey", "red", "orange", "purple"]),
    name: PropTypes.string.isRequired,
    tip: PropTypes.node,
    tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"]),
    faStyle: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string,
    fixedWidth: PropTypes.bool,
    style: PropTypes.object
};

Icon.defaultProps = {
    faStyle: "fas",
    fixedWidth: false
};

export const LinkIcon = ({ to, replace, ...props }) => (
    <Link to={to} replace={replace}>
        <Icon {...props} hoverable />
    </Link>
);
