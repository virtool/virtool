import { Menu, MenuButton, MenuItem, MenuLink, MenuList } from "@reach/menu-button";
import "@reach/menu-button/styles.css";
import React from "react";
import { Link } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";
import { getBorder, getFontSize } from "../app/theme";
import { StyledButton } from "./Button";

const dropdownItemMixin = css`
    color: ${props => props.theme.color.black};
    cursor: pointer;
    min-width: 160px;
    padding: 10px 15px;

    &:hover {
        background-color: ${props => props.theme.color.greyHover};
        color: ${props => props.theme.color.black};
    }
`;

const slideDown = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const DropdownMenuList = styled(MenuList)`
    animation: ${slideDown} ease-in 100ms;
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.lg};
    display: flex;
    flex-direction: column;
    font-size: ${getFontSize("md")};
    padding: 0;
`;

export const DropdownMenuItem = styled(MenuItem)`
    ${dropdownItemMixin}
`;

export const DropdownMenuLink = styled(({ children, className, to }) => (
    <MenuLink as={Link} className={className} to={to}>
        {children}
    </MenuLink>
))`
    ${dropdownItemMixin}
`;

export const DropdownButton = ({ children }) => <StyledButton as={MenuButton}>{children}</StyledButton>;

export const Dropdown = Menu;
