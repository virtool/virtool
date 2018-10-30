import React from "react";
import { find, get, replace } from "lodash-es";
import { Col, Panel, ProgressBar, Row } from "react-bootstrap";
import { connect } from "react-redux";

import { installHMMs } from "../actions";
import { Button, Flex, FlexItem, Alert } from "../../base";
import { checkAdminOrPermission } from "../../utils";

class HMMInstall extends React.Component {
    handleInstall = () => {
        this.props.onInstall(this.props.releaseId);
    };

    getProcess = () => {
        if (this.props.processId && this.props.processes.length) {
            const process = find(this.props.processes, ["id", this.props.processId]);
            return process || null;
        }
    };

    render() {
        if (this.props.processId && !this.props.installed) {
            const process = this.getProcess();
            const progress = process.progress * 100;
            const step = replace(process.step, "_", " ");

            const barStyle = progress === 100 ? "success" : "warning";

            return (
                <Panel>
                    <Panel.Body>
                        <Row>
                            <Col xs={10} xsOffset={1} md={6} mdOffset={3}>
                                <div className="text-center">
                                    <p>
                                        <strong>Installing</strong>
                                    </p>
                                    <ProgressBar bsStyle={barStyle} now={progress} />
                                    <p>
                                        <small className="text-muted text-capitalize">{step}</small>
                                    </p>
                                </div>
                            </Col>
                        </Row>
                    </Panel.Body>
                </Panel>
            );
        }

        const installOption = this.props.canInstall ? (
            <Button icon="download" onClick={this.handleInstall}>
                Install Official
            </Button>
        ) : (
            <Alert bsStyle="warning" icon="exclamation-circle">
                <strong>You do not have permission to install HMMs.</strong>
                <span> Contact an administrator.</span>
            </Alert>
        );

        return (
            <Panel>
                <Panel.Body>
                    <Flex justifyContent="center" style={{ padding: "10px 0" }}>
                        <FlexItem>
                            <i
                                className="fas fa-info-circle text-primary"
                                style={{ fontSize: "40px", padding: "5px 10px 0 5px" }}
                            />
                        </FlexItem>

                        <FlexItem>
                            <p style={{ fontSize: "22px", margin: "0 0 3px" }}>No HMM data available.</p>

                            <p className="text-muted">
                                You can download and install the offical HMM data automatically from our
                                <a href="https://github.com/virtool/virtool-hmm"> GitHub repository</a>.
                            </p>

                            {installOption}
                        </FlexItem>
                    </Flex>
                </Panel.Body>
            </Panel>
        );
    }
}

const mapStateToProps = state => ({
    processId: get(state.hmms.status, "process.id"),
    releaseId: get(state.hmms.status, "release.id"),
    installed: !!state.hmms.status.installed,
    processes: state.processes.documents,
    canInstall: checkAdminOrPermission(state, "modify_hmm")
});

const mapDispatchToProps = dispatch => ({
    onInstall: releaseId => {
        dispatch(installHMMs(releaseId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMInstall);
