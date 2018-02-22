import React from "react";
import { connect } from "react-redux";
import { Popover } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { map } from "lodash-es";
import { getSoftwareUpdates } from "../../updates/actions";
import { getUnbuilt } from "../../indexes/actions";

const getInitialState = (props) => {
    const notifArray = [];

    if (props.updates && props.updates.length) {
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

    console.log(notifArray);

    return { notifArray };
};

class Notifications extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    componentWillReceiveProps (nextProps) {
        if (this.props.updates !== nextProps.updates) {
            this.setState(getInitialState(nextProps));
        }
    }

    render () {

    //    console.log(this.props.updates);

        const { notifArray } = this.state;

        const notifications = map(notifArray, (item, index) =>
            <div key={index}>
                <LinkContainer to={item.link}>
                    <div>
                        {item.message}
                    </div>
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
