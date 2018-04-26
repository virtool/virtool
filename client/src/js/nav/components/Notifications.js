import React from "react";
import { connect } from "react-redux";
import { Popover } from "react-bootstrap";
import { Link } from "react-router-dom";

const Notifications = (props) => {

    const notificationStyle = {
        padding: "10px 10px",
        margin: 0
    };

    let notification;

    if (props.isAdmin && props.updates && props.updates.releases.length) {
        notification = (
            <div style={notificationStyle}>
                <Link to="/settings/updates">
                    Software update available
                </Link>
            </div>
        );
    }

    return (
        <Popover
            id="notification-popover"
            title="Notifications"
            placement="bottom"
            style={props.style}
            onClick={props.onClick}
        >
            <div className="notification">
                {notification}
            </div>
        </Popover>
    );
};

const mapStateToProps = (state) => ({
    updates: state.updates.software,
    isAdmin: state.account.administrator
});

export default connect(mapStateToProps)(Notifications);
