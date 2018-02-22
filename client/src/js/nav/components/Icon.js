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

        this.setState({
            show: !this.state.show
        });
    }

    componentWillMount () {
        this.props.onGet();
        this.props.onGetUnbuilt();
    }

    // gives infinite render loop for some reason
/*
    componentWillReceiveProps (nextProps) {

        console.log("a");

        if (this.props.updates !== nextProps.updates) {
            this.props.onGet();
        }

        if (this.props.unbuilt !== nextProps.unbuilt) {
            this.props.onGetUnbuilt();
        }
    }
*/
    render () {

        console.log(this.props);

        const iconStyle = (this.props.updates || this.props.unbuilt) ? "yellow" : "white";

        return (
            <div>
                <div ref={node => this.target = node} onClick={this.handleToggle}>
                    <Icon
                        name="notification"
                        tip="Click to see notifications"
                        tipPlacement="left"
                        style={{color: iconStyle}}
                    />
                </div>

                <Overlay
                    show={this.state.show}
                    onHide={() => this.setState({ show: false })}
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
