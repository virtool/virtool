import React from "react";
import { connect } from "react-redux";
import { NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { Icon } from "../../base";

const NotificationIcon = ({ visible }) => {
    if (visible) {
        return (
            <NavItem>
                <LinkContainer to="/administration/updates">
                    <Icon className="icon-pulse" name="arrow-alt-circle-up" tip="Software Update" tipPlacement="left" />
                </LinkContainer>
            </NavItem>
        );
    }

    return <div />;
};

const mapStateToProps = state => ({
    visible: !!(state.account.administrator && state.updates.releases && state.updates.releases.length)
});

export default connect(mapStateToProps)(NotificationIcon);
