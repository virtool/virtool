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
        this.props.onSetSoftwareChannel(this.props.channel);
    };

    render () {
        return (
            <Radio
                label={`${capitalize(this.props.channel)}${this.props.channel === "stable" ? " (recommended)" : ""}`}
                checked={this.props.checked}
                onClick={this.handleClick}
            />
        );
    }
}

class SoftwareUpdateViewer extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return <LoadingPlaceholder />;
        }

        const releases = this.props.updates.releases;

        let installModal;
        let updateComponent;

        if (releases.length) {
            const releaseComponents = map(releases, release =>
                <Release key={release.name} {...release} />
            );

            installModal = <InstallModal releases={releases} />;

            updateComponent = (
                <Panel>
                    <Flex alignItems="center" style={{marginBottom: "15px"}}>
                        <FlexItem grow={1} shrink={0}>
                            <strong className="text-warning">
                                <Icon name="info" /> Update{releases.length === 1 ? "" : "s"} Available
                            </strong>
                        </FlexItem>
                        <FlexItem grow={0} shrink={0} pad={15}>
                            <Button icon="download" bsStyle="primary" onClick={this.props.onShowModal}>
                                Install
                            </Button>
                        </FlexItem>
                    </Flex>

                    <ListGroup>
                        {releaseComponents}
                    </ListGroup>
                </Panel>
            );
        } else {
            updateComponent = (
                <Panel>
                    <Icon bsStyle="success" name="checkmark" />
                    <strong className="text-success"> Software is up-to-date</strong>
                </Panel>
            );
        }

        const radioComponents = map(["stable", "beta", "alpha"], channel =>
            <ChannelButton
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
                        {updateComponent}
                    </Col>
                    <Col xs={12} md={4}>
                        <Panel>
                            <Row>
                                <Col xs={12}>
                                    <label>Software Channel</label>
                                    {radioComponents}
                                </Col>
                            </Row>
                        </Panel>
                    </Col>
                </Row>
                {installModal}
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

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);

export default Container;
