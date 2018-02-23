import React from "react";
import { connect } from "react-redux";
import { Overlay } from "react-bootstrap";
import Notifications from "./Notifications";
import { getSoftwareUpdates } from "../../updates/actions";
import { getUnbuilt } from "../../indexes/actions";

import { Icon } from "../../base";

class NotificationIcon extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            show: false
        };
    }

    handleToggle = () => {

        if (this.state.show) {
            window.removeEventListener("click", this.handleExit, false);
        } else {
            window.addEventListener("click", this.handleExit, false);
        }

        this.setState({
            show: !this.state.show
        });
    }

    handleExit = (e) => {
        if (this.target.contains(e.target)) {
            return;
        }

        this.handleToggle();
    }

    componentWillMount () {
        this.props.onGet();
        this.props.onGetUnbuilt();
    }

    componentDidMount () {
        this.interval = window.setInterval(() => {
            this.props.onGet();
            this.props.onGetUnbuilt();
        }, 10000);
    }

    componentWillUnmount () {
        window.clearInterval(this.interval);
    }

    render () {

        const iconStyle = (this.props.updates || this.props.unbuilt) ? "icon-pulse" : "icon";

        return (
            <div>
                <div ref={node => this.target = node} onClick={this.handleToggle}>
                    <Icon
                        className={iconStyle}
                        name="notification"
                        tip="Click to see notifications"
                        tipPlacement="left"
                    />
                </div>

                <Overlay
                    show={this.state.show}
                    placement="bottom"
                    target={this.target}
                >
                    <Notifications onClick={this.handleToggle} />
                </Overlay>
            </div>
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

const Container = connect(mapStateToProps, mapDispatchToProps)(NotificationIcon);

export default Container;
