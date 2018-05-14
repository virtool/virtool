import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Nav } from "react-bootstrap";
import { SidebarItem } from "./SidebarItem";
import { startsWith } from "lodash-es";

const isHomeActive = (location) => {
    if (startsWith(location.pathname, "/jobs")) {
        return "Jobs";
    } else if (startsWith(location.pathname, "/samples")) {
        return "Samples";
    } else if (startsWith(location.pathname, "/refs")) {
        return "References";
    } else if (startsWith(location.pathname, "/subtraction")) {
        return "Subtraction";
    } else if (startsWith(location.pathname, "/hmm")) {
        return "HMM";
    }
};

const Sidebar = (props) => {

    const activeTab = isHomeActive(props.location);

    switch (activeTab) {
        case "Jobs":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="Browse" link="/jobs" icon="th-list" />
                    <SidebarItem title="Resources" link="/jobs/resources" icon="tachometer-alt" />
                    <SidebarItem title="Settings" link="/jobs/settings" icon="cogs" />
                </Nav>
            );
        case "Samples":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="Browse" link="/samples" icon="th-list" />
                    <SidebarItem title="Files" link="/samples/files" icon="folder-open" />
                    <SidebarItem title="Settings" link="/samples/settings" icon="cogs" />
                </Nav>
            );
        case "References":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="Browse" link="/refs" icon="th-list" />
                    <SidebarItem title="Settings" link="/refs/settings" icon="cogs" />
                </Nav>
            );
        case "Subtraction":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="Browse" link="/subtraction" icon="th-list" />
                    <SidebarItem title="Files" link="/subtraction/files" icon="folder-open" />
                </Nav>
            );
        case "HMM":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="Browse" link="/hmm" icon="th-list" />
                </Nav>
            );
        default:
            return <Nav className="sidebar" />;
    }
};

const mapStateToProps = (state) => ({
    ...state.account
});

export default withRouter(connect(mapStateToProps, null)(Sidebar));
