import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { NavLink } from "react-router-dom";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Icon } from "../../base";

const StyledSidebarItem = styled(NavLink)`
    color: ${props => props.theme.color.greyDark};
    cursor: pointer;
    padding-bottom: 1.4rem;
    text-align: center;
    width: 100%;

    &:hover {
        color: ${props => props.theme.color.greyDarkest};
    }

    &.active {
        color: ${props => props.theme.color.primary};
        font-weight: ${getFontWeight("thick")};
    }

    i {
        font-size: 16px;
    }

    p {
        display: block;
        font-size: ${getFontSize("md")};
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
