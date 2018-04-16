import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem } from "react-bootstrap";
import { Icon } from "../../base";
import { startsWith } from "lodash-es";

const isHomeActive = (location) => {

    let activeTab;

    if (startsWith(location.pathname, "/jobs")) {
        activeTab = "Jobs";
    } else if (startsWith(location.pathname, "/samples")) {
        activeTab = "Samples";
    } else if (startsWith(location.pathname, "/viruses")) {
        activeTab = "Viruses";
    } else if (startsWith(location.pathname, "/subtraction")) {
        activeTab = "Subtraction";
    } else if (startsWith(location.pathname, "/administration")) {
        activeTab = "Administration";
    } else if (startsWith(location.pathname, "/hmm")) {
        activeTab = "HMM";
    }

    return activeTab;
};

const Sidebar = (props) => {

    const activeTab = isHomeActive(props.location);
    let sidebarComponents;

    switch (activeTab) {

        case "Jobs":
            sidebarComponents = (
                <Nav className="sidebar">
                    <LinkContainer to="/jobs">
                        <NavItem className="sidebar-item">
                            <Icon name="menu" />
                            <div>List</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/jobs/resources">
                        <NavItem className="sidebar-item">
                            <Icon name="meter" />
                            <div>Resources</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/jobs/settings">
                        <NavItem className="sidebar-item">
                            <Icon name="cog" />
                            <div>Settings</div>
                        </NavItem>
                    </LinkContainer>
                </Nav>
            );
            break;
        case "Samples":
            sidebarComponents = (
                <Nav className="sidebar">
                    <LinkContainer to="/samples">
                        <NavItem className="sidebar-item">
                            <Icon name="menu" />
                            <div>List</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/samples/files">
                        <NavItem className="sidebar-item">
                            <Icon name="folder-open" />
                            <div>Files</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/samples/settings">
                        <NavItem className="sidebar-item">
                            <Icon name="cog" />
                            <div>Settings</div>
                        </NavItem>
                    </LinkContainer>
                </Nav>
            );
            break;
        case "Viruses":
            sidebarComponents = (
                <Nav className="sidebar">
                    <LinkContainer to="/viruses">
                        <NavItem className="sidebar-item">
                            <Icon name="menu" />
                            <div>List</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/viruses/indexes">
                        <NavItem className="sidebar-item">
                            <Icon name="filing" />
                            <div>Indexes</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/viruses/settings">
                        <NavItem className="sidebar-item">
                            <Icon name="cog" />
                            <div>Settings</div>
                        </NavItem>
                    </LinkContainer>
                </Nav>
            );
            break;
        case "Subtraction":
            sidebarComponents = (
                <Nav className="sidebar">
                    <LinkContainer to="/subtraction">
                        <NavItem className="sidebar-item">
                            <Icon name="menu" />
                            <div>List</div>
                        </NavItem>
                    </LinkContainer>
                    <LinkContainer to="/subtraction/files">
                        <NavItem className="sidebar-item">
                            <Icon name="folder-open" />
                            <div>Files</div>
                        </NavItem>
                    </LinkContainer>
                </Nav>
            );
            break;
        case "Administration":
            sidebarComponents = props.permissions.modify_settings
                ? (
                    <Nav className="sidebar">
                        <LinkContainer to="/administration/server">
                            <NavItem className="sidebar-item">
                                <Icon name="cloud" />
                                <div>Server</div>
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to="/administration/data">
                            <NavItem className="sidebar-item">
                                <Icon name="database" />
                                <div>Data</div>
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to="/administration/users">
                            <NavItem className="sidebar-item">
                                <Icon name="users" />
                                <div>Users</div>
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to="/administration/updates">
                            <NavItem className="sidebar-item">
                                <Icon name="plus-square" />
                                <div>Updates</div>
                            </NavItem>
                        </LinkContainer>
                    </Nav>
                ) : <Nav className="sidebar" />;
            break;
        case "HMM":
            sidebarComponents = (             
                <Nav className="sidebar">
                    <LinkContainer to="/hmm">
                        <NavItem className="sidebar-item">
                            <Icon name="menu" />
                            <div>List</div>
                        </NavItem>
                    </LinkContainer>
                </Nav>
            );
    break;
        default:
            sidebarComponents = <Nav className="sidebar" />;
    }

    return sidebarComponents;
};

const mapStateToProps = (state) => ({
    ...state.account
});

export default withRouter(connect(mapStateToProps, null)(Sidebar));
