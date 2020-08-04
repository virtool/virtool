import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownMenu, Icon, useDropdown } from "../../base";
import { NavBarItem } from "./NavBarItem";

const NavDropdownTrigger = styled(NavBarItem)`
    align-items: center;
    display: flex;
    height: 45px;
    padding: 0 10px;

    :focus {
        color: ${props => props.theme.color.primaryDarkest};
    }

    *:not(:last-child) {
        margin-right: 3px;
    }
`;

export const NavDropdown = ({ children, userId }) => {
    const [visible, toggle, hide] = useDropdown([userId]);

    function handleClick(e) {
        e.preventDefault();
        toggle();
    }

    return (
        <Dropdown>
            <NavDropdownTrigger as="a" href="#" onClick={handleClick} onBlur={hide}>
                <Icon name="user" />
                <span>{userId}</span>
                <Icon name="caret-down" />
            </NavDropdownTrigger>
            <DropdownMenu right={0} top={50} visible={visible}>
                {children}
            </DropdownMenu>
        </Dropdown>
    );
};
