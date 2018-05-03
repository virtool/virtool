import React from "react";
import { capitalize, map } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel, ListGroup } from "react-bootstrap";

import { getSoftwareUpdates, showInstallModal } from "../actions";
import { updateSetting } from "../../settings/actions";
import { Button, Flex, FlexItem, Icon, Radio, LoadingPlaceholder } from "../../base";
import Release from "./Release";
import InstallModal from "./Install";

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

const Releases = ({ onShowModal, releases }) => {

    if (releases.length) {
        const releaseComponents = map(releases, release =>
            <Release key={release.name} {...release} />
        );

        return (
            <Panel>
                <Panel.Body>
                    <Flex alignItems="center" style={{marginBottom: "15px"}}>
                        <FlexItem grow={1} shrink={0}>
                            <strong className="text-warning">
                                <Icon name="arrow-alt-circle-up" /> Update{releases.length === 1 ? "" : "s"} Available
                            </strong>
                        </FlexItem>
                        <FlexItem grow={0} shrink={0} pad={15}>
                            <Button icon="download" bsStyle="primary" onClick={onShowModal}>
                                Install
                            </Button>
                        </FlexItem>
                    </Flex>

                    <ListGroup>
                        {releaseComponents}
                    </ListGroup>
                </Panel.Body>
            </Panel>
        );
    }

    return (
        <Panel>
            <Panel.Body>
                <Icon bsStyle="success" name="checkmark" />
                <strong className="text-success"> Software is up-to-date</strong>
            </Panel.Body>
        </Panel>
    );
};

class SoftwareUpdateViewer extends React.Component {

    componentWillMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return <LoadingPlaceholder />;
        }

        const releases = this.props.updates.releases;

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
                        <Releases
                            releases={releases}
                            onShowModal={this.props.onShowModal}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Panel>
                            <Panel.Body>
                                <Row>
                                    <Col xs={12}>
                                        <label>Software Channel</label>
                                        {radioComponents}
                                    </Col>
                                </Row>
                            </Panel.Body>
                        </Panel>
                    </Col>
                </Row>

                {releases.length ? <InstallModal releases={releases} /> : null}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    updates: state.updates.software,
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
