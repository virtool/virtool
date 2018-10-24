import React from "react";
import { includes } from "lodash-es";
import { NavLink } from "react-router-dom";
import { Icon } from "../../base";

function excludePaths(paths = []) {
  return function(match, location) {
    if (includes(paths, location.pathname)) {
      return false;
    }

    return !!match;
  };
}

export default function SidebarItem({ exclude, icon, link, title }) {
  return (
    <NavLink
      to={link}
      className="sidebar-item"
      activeClassName="active"
      isActive={excludePaths(exclude)}
    >
      <Icon name={icon} />
      <div>
        <small>{title}</small>
      </div>
    </NavLink>
  );
}
