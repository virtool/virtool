import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import styled from "styled-components";
import { Icon } from "../../base";

const UpdateIcon = styled(Icon)`
    color: white;
    opacity: 1;
    margin-right: 15px;
    &:hover {
        color: rgb(50, 112, 111);
    }
`;

export const NotificationIcon = ({ visible }) => {
    if (visible) {
        return (
            <LinkContainer to="/administration/updates">
                <UpdateIcon
                    className="icon-pulse"
                    name="arrow-alt-circle-up"
                    tip="Software Update"
                    tipPlacement="left"
                />
            </LinkContainer>
        );
    }

    return <div />;
};

export const mapStateToProps = state => ({
    visible: !!(state.account.administrator && state.updates.releases && state.updates.releases.length)
});

export default connect(mapStateToProps)(NotificationIcon);
