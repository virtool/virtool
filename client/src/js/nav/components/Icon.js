import React from "react";
import { connect } from "react-redux";
import { getSoftwareUpdates } from "../../updates/actions";
import Notifications from "./Notifications";
import { Icon } from "../../base";
import { Overlay } from "react-bootstrap";

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
    };

    handleExit = (e) => {
        e.preventDefault();

        if (!this.target.contains(e.target)) {
            this.handleToggle();
        }
    }

    componentDidMount () {
        this.props.onGet();

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

        const notificationPopover = (this.state.show &&
            <Overlay
                show={this.state.show}
                placement="bottom"
                target={this.target}
            >
                <Notifications onClick={this.handleToggle} />
            </Overlay>
        );

        if (this.props.isAdmin) {

            return (
                <div>
                    <div ref={node => this.target = node} onClick={this.state.show ? null : this.handleToggle}>
                        <Icon
                            className={iconStyle}
                            name="exclamation-circle"
                            tip="Click to see notifications"
                            tipPlacement="left"
                        />
                    </div>

                    {notificationPopover}
                </div>
            );
        }


        return <div />;
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
