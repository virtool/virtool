import React from "react";
import { connect } from "react-redux";
import { Popover } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { map } from "lodash-es";
import { getSoftwareUpdates } from "../../updates/actions";
import { getUnbuilt } from "../../indexes/actions";

const getInitialState = (props) => {
    const notifArray = [];

    if (props.updates) {
        notifArray.push({
            message: "Software updates available",
            link: "/settings/updates"
        });

    }

    if (props.unbuilt) {
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

    componentWillMount () {
        this.props.onGet();
        this.props.onGetUnbuilt();
    }

    componentWillReceiveProps (nextProps) {
        if (this.props.updates !== nextProps.updates) {
            this.setState(getInitialState(nextProps));
        }
    }

    render () {

        const { notifArray } = this.state;

        const notifications = map(notifArray, (item, index) =>
            <div
                key={index}
                style={{
                    border: "1px solid lightgrey",
                    margin: "0 -5px -1px -5px",
                    padding: "5px 10px"
                }}
                onClick={this.props.onClick}
            >
                <LinkContainer to={item.link}>
                    <a>
                        {item.message}
                    </a>
                </LinkContainer>
            </div>
        );

        return (
            <Popover
                id="notification-popover"
                title="Notifications"
                placement="bottom"
                style={{
                    ...this.props.style,
                    position: "absolute"
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

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    },

    onGetUnbuilt: () => {
        dispatch(getUnbuilt());
    }
});

const Container = connect(mapStateToProps, mapDispatchToProps)(Notifications);

export default Container;
