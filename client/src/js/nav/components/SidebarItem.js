import PropTypes from "prop-types";
import React from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../../base";
import { excludePaths } from "../utils";

export default function SidebarItem({ exclude, icon, link, title }) {
    return (
        <NavLink to={link} className="sidebar-item" activeClassName="active" isActive={excludePaths(exclude)}>
            <Icon name={icon} />
            <div>
                <small>{title}</small>
            </div>
        </NavLink>
    );
}

SidebarItem.propTypes = {
    exclude: PropTypes.arrayOf(PropTypes.string),
    icon: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};
