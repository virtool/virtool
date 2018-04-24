import React from "react";
import { connect } from "react-redux";
import { Overlay } from "react-bootstrap";
import Notifications from "./Notifications";
import { getSoftwareUpdates } from "../../updates/actions";

import { Icon } from "../../base";

class NotificationIcon extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            show: false
        };
    }

    handleToggle = () => {
        this.setState({
            show: !this.state.show
        });
    };

    componentWillMount () {
        this.props.onGet();
    }

    componentDidMount () {
        this.interval = window.setInterval(() => {
            this.props.onGet();
        }, 300000);
    }

    componentWillUnmount () {
        window.clearInterval(this.interval);
    }

    render () {

        const availableUpdates = this.props.updates ? this.props.updates.releases.length : null;

        const iconStyle = availableUpdates ? "icon-pulse" : "icon";

        return (
            <div>
                <div ref={node => this.target = node} onClick={this.state.show ? null : this.handleToggle}>
                    <Icon
                        className={iconStyle}
                        name="notification"
                        tip="Click to see notifications"
                        tipPlacement="left"
                    />
                </div>

                <Overlay show={this.state.show} placement="bottom" target={this.target}>
                    <Notifications onClick={this.handleToggle} />
                </Overlay>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    updates: state.updates.software,
    isAdmin: state.account.administrator
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(NotificationIcon);
