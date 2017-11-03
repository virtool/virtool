import React from "react";
import { capitalize, filter, toNumber } from "lodash";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Row, Col, Panel, ListGroup } from "react-bootstrap";

import { getSoftwareUpdates, showInstallModal } from "../actions";
import { updateSetting } from "../../settings/actions";
import { Button, Icon, Radio } from "../../base";
import Release from "./Release";
import InstallModal from "./Install";

class SoftwareUpdateViewer extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return (
                <div className="text-center" style={{marginTop: "220px"}}>
                    <ClipLoader color="#3c8786" size="24px" />
                </div>
            );
        }

        const currentVersion = this.props.updates.current_version;

        let [ currentNumber, currentPre ] = currentVersion.replace("v", "").split("-").map(part =>
            part.split(".").map(toNumber)
        );

        const releases = filter(this.props.updates.releases, release => {
            const [ number, pre ] = release.name.replace("v", "").split("-").map(part => part.split("."));

            // Return false if the version number is
            if (currentNumber[0] !== number[0]) {
                return number[0] > currentNumber[0];
            }

            if (currentNumber[1] !== number[1]) {
                return number[1] > currentNumber[1];
            }

            if (currentNumber[1] !== number[1]) {
                return number[2] > currentNumber[2];
            }

            // Reject if release is a pre-release, but current one isn't.
            if (!currentPre && pre) {
                return false;
            }

            // Reject if the release is alpha, but current on is beta.
            if (currentPre && currentPre[0] === "beta" && pre[0] === "alpha") {
                return false;
            }

            return currentPre[1] < pre[1];
        });

        let installModal;
        let updateComponent;

        if (releases.length) {
            const releaseComponents = releases.map(release =>
                <Release key={release.name} {...release} />
            );

            installModal = <InstallModal releases={releases} />;

            updateComponent = (
                <Panel>
                    <h5>
                        <strong className="text-warning">
                            <Icon name="info" /> Update{releases.length === 1 ? "": "s"} Available
                        </strong>
                    </h5>

                    <ListGroup>
                        {releaseComponents}
                    </ListGroup>

                    <span className="pull-right">
                        <Button icon="download" bsStyle="primary" onClick={this.props.onShowModal}>
                            Install
                        </Button>
                    </span>
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

        const radioComponents = ["stable", "beta", "alpha"].map((channel) =>
            <Radio
                key={channel}
                checked={this.props.channel === channel}
                label={`${capitalize(channel)}${channel === "stable" ? " (recommended)": ""}`}
                onClick={() => this.props.onSetSoftwareChannel(channel)}
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

const mapStateToProps = (state) => {
    return {
        updates: state.updates.software,
        channel: state.settings.data.software_channel
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getSoftwareUpdates());
        },

        onSetSoftwareChannel: (value) => {
            dispatch(updateSetting("software_channel", value));
        },

        onShowModal: () => {
            dispatch(showInstallModal());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);

export default Container;
