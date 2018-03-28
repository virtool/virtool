import React from "react";
import { connect } from "react-redux";
import { Popover } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { map } from "lodash-es";

const getInitialState = (props) => {
    const notifArray = [];

    if (props.updates && props.updates.releases.length) {
        notifArray.push({
            message: props.canUpdate
                ? "Software updates available"
                : "Software updates available:\nRequires administrator to install",
            link: props.canUpdate ? "/settings/updates" : ""
        });

    }

    if (props.modifiedCount || props.modifiedVirusCount) {
        notifArray.push({
            message: "Rebuild Index",
            link: "/viruses/indexes"
        });
    }

    return { notifArray };
};

class Notifications extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    componentWillReceiveProps (nextProps) {
        if (this.props !== nextProps) {
            this.setState(getInitialState(nextProps));
        }
    }

    render () {

        const { notifArray } = this.state;
        const notifStyle = {
            border: "1px solid lightgrey",
            margin: "0 -5px -1px -5px",
            padding: "5px 10px"
        };
        let notifications;

        if (notifArray.length) {
            notifications = map(notifArray, (item, index) =>
                <div
                    key={index}
                    style={notifStyle}
                    onClick={this.props.onClick}
                >
                    <LinkContainer to={item.link}>
                        <a>
                            {item.message}
                        </a>
                    </LinkContainer>
                </div>
            );
        } else {
            notifications = (
                <div
                    style={notifStyle}
                >
                    No new notifications
                </div>
            );
        }


        return (
            <Popover
                id="notification-popover"
                title="Notifications"
                placement="bottom"
                style={{
                    ...this.props.style,
                    position: "absolute",
                    minWidth: "250px",
                    maxWidth: "250px"
                }}
            >
                {notifications}
            </Popover>
        );
    }
}

const mapStateToProps = (state) => ({
    updates: state.updates.software,
    modifiedVirusCount: state.indexes.modified_virus_count,
    modifiedCount: state.viruses.modified_count,
    canUpdate: state.account.permissions.modify_settings
});

export default connect(mapStateToProps)(Notifications);
