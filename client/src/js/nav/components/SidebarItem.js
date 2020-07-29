import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { NavLink } from "react-router-dom";
import { Icon } from "../../base";

const StyledSidebarItem = styled(NavLink)`
    color: #333333;
    cursor: pointer;
    padding-bottom: 1.4rem;
    text-align: center;
    width: 100%;
    opacity: 0.7;

    &:focus {
        text-decoration: none;
    }

    &:hover {
        opacity: 1;
        text-decoration: none;
        color: #07689d;
    }

    &.active {
        opacity: 1;
        color: #07689d;
    }

    p {
        display: block;
        font-size: ${props => props.theme.fontSize.sm};
        margin: 0.4rem 0;
    }
`;

import { excludePaths } from "../utils";

export default function SidebarItem({ exclude, icon, link, title }) {
    return (
        <StyledSidebarItem to={link} activeClassName="active" isActive={excludePaths(exclude)}>
            <Icon name={icon} />
            <p>{title}</p>
        </StyledSidebarItem>
    );
}

SidebarItem.propTypes = {
    exclude: PropTypes.arrayOf(PropTypes.string),
    icon: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};
