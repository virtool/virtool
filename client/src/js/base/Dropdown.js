import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { getBorder } from "../app/theme";

export const useDropdown = inputs => {
    const [visible, setVisible] = useState(false);

    const toggle = useCallback(() => {
        setVisible(!visible);
    }, [...inputs, visible]);

    const hide = useCallback(() => {
        setTimeout(() => {
            setVisible(false);
        }, 100);
    }, [...inputs]);

    return [visible, toggle, hide];
};

const StyledDropdownItem = styled.a`
    color: ${props => props.theme.color.black};
    cursor: pointer;
    min-width: 160px;
    padding: 10px 15px;

    &:hover {
        background-color: ${props => props.theme.color.greyHover};
        color: ${props => props.theme.color.greyDarkest};
    }
`;

export const DropdownItem = ({ children, href, rel, target, to, onClick }) => {
    if (to) {
        return (
            <StyledDropdownItem as={Link} rel={rel} target={target} to={to}>
                {children}
            </StyledDropdownItem>
        );
    }

    return (
        <StyledDropdownItem href={href} onClick={onClick}>
            {children}
        </StyledDropdownItem>
    );
};

export const DropdownMenu = styled.div`
    background-color: ${props => props.theme.color.white};
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.lg};
    display: ${props => (props.visible ? "flex" : "none")};
    flex-direction: column;
    position: absolute;
    right: ${props => props.right}px;
    top: ${props => props.top}px;
    z-index: 100;
`;

export const Dropdown = styled.div`
    align-items: stretch;
    background: transparent;
    display: flex;
    justify-content: center;
    padding: 0;
    position: relative;
`;
