import {capitalize, map} from "lodash-es";
import React from "react";
import {Col, Panel, Row} from "react-bootstrap";
import {connect} from "react-redux";
import {updateSetting} from "../../administration/actions";
import {LoadingPlaceholder, Radio} from "../../base";

import InstallModal from "./Install";
import Channels from "./Channels";
import Releases from "./Releases";
import { getSoftwareUpdates } from "../actions";


class ChannelButton extends React.Component {

    handleClick = () => {
        this.props.onClick(this.props.channel);
    };

    render () {

        const { channel, checked } = this.props;

        return (
            <Radio
                label={`${capitalize(channel)}${channel === "stable" ? " (recommended)" : ""}`}
                checked={checked}
                onClick={this.handleClick}
            />
        );
    }
}

class SoftwareUpdateViewer extends React.Component {

    componentDidMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return <LoadingPlaceholder />;
        }
        const radioComponents = map(["stable", "beta", "alpha"], channel =>
            <ChannelButton
                key={channel}
                channel={channel}
                checked={channel === this.props.channel}
                onClick={this.props.onSetSoftwareChannel}
            />
        );

        return (
            <div>
                <Row>
                    <Col xs={12}>
                        <h5>
                            <strong>Software Updates</strong>
                        </h5>
                    </Col>
                    <Col xs={12} md={8}>
                        <Releases />
                    </Col>
                    <Col xs={12} md={4}>
                        <Channels />
                    </Col>
                </Row>

                {releases.length ? <InstallModal releases={releases} /> : null}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    channel: state.settings.data.software_channel
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    },

    onSetSoftwareChannel: (value) => {
        dispatch(updateSetting("software_channel", value));
    },

    onShowModal: () => {
        dispatch(showInstallModal());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);
