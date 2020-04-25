import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownMenu, Icon, useDropdown } from "../../base";

const NavDropdownTrigger = styled.a`
    align-items: center;
    color: white;
    display: flex;
    height: 45px;
    text-decoration: none;

    :hover {
        color: #245251;
    }

    *:not(:last-child) {
        margin-right: 3px;
    }
`;

export const NavDropdown = ({ children, userId }) => {
    const [visible, toggle, hide] = useDropdown([userId]);

    return (
        <Dropdown>
            <NavDropdownTrigger onClick={toggle} onBlur={hide} href="#">
                <Icon name="user" />
                <span>{userId}</span>
                <Icon name="caret-down" />
            </NavDropdownTrigger>

            <DropdownMenu right={-5} top={45} visible={visible}>
                {children}
            </DropdownMenu>
        </Dropdown>
    );
};
