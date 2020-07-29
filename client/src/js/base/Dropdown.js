import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

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
    color: black;
    cursor: pointer;
    min-width: 160px;
    padding: 10px 15px;

    &:hover {
        background-color: #f5f5f5;
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
    background-color: white;
    border: 1px solid ${props => props.theme.color.greyLight};
    box-shadow: 0 8px 16px 0 rgba(0, 0, 0, 0.2);
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
