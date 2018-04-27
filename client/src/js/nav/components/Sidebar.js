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
    } else if (startsWith(location.pathname, "/viruses")) {
        return "Viruses";
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
                    <SidebarItem title="List" link="/jobs" icon="menu" />
                    <SidebarItem title="Resources" link="/jobs/resources" icon="meter" />
                    <SidebarItem title="Settings" link="/jobs/settings" icon="cog" />
                </Nav>
            );
        case "Samples":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="List" link="/samples" icon="menu" />
                    <SidebarItem title="Files" link="/samples/files" icon="folder-open" />
                    <SidebarItem title="Settings" link="/samples/settings" icon="cog" />
                </Nav>
            );
        case "Viruses":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="List" link="/viruses" icon="menu" />
                    <SidebarItem title="Indexes" link="/viruses/indexes" icon="filing" />
                    <SidebarItem title="Settings" link="/viruses/settings" icon="cog" />
                </Nav>
            );
        case "Subtraction":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="List" link="/subtraction" icon="menu" />
                    <SidebarItem title="Files" link="/subtraction/files" icon="folder-open" />
                </Nav>
            );
        case "HMM":
            return (
                <Nav className="sidebar">
                    <SidebarItem title="List" link="/hmm" icon="menu" />
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
