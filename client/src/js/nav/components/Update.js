import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { getAccountAdministrator } from "../../account/selectors";
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
            <Link to="/administration/updates">
                <UpdateIcon
                    className="icon-pulse"
                    name="arrow-alt-circle-up"
                    tip="Software Update"
                    tipPlacement="left"
                />
            </Link>
        );
    }

    return <div />;
};

export const mapStateToProps = state => ({
    visible: !!(getAccountAdministrator(state) && state.updates.releases && state.updates.releases.length)
});

export default connect(mapStateToProps)(NotificationIcon);
