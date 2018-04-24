import React from "react";
import { NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { Icon } from "../../base";

export const SidebarItem = (props) => (

    <LinkContainer to={props.link}>
        <NavItem className="sidebar-item">
            <Icon name={props.icon} />
            <div>{props.title}</div>
        </NavItem>
    </LinkContainer>
    
);
