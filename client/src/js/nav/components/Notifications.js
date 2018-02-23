import React from "react";
import { connect } from "react-redux";
import { Popover } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { map } from "lodash-es";

const getInitialState = (props) => {
    const notifArray = [];

    if (props.updates && props.updates.releases.length) {
        notifArray.push({
            message: "Software updates available",
            link: "/settings/updates"
        });

    }

    if (props.unbuilt && props.unbuilt.history.length) {
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
    unbuilt: state.indexes.unbuilt
});

const Container = connect(mapStateToProps)(Notifications);

export default Container;
