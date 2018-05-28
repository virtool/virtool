import React from "react";
import Numeral from "numeral";
import { find, get, replace } from "lodash-es";
import { Col, Panel, ProgressBar, Row } from "react-bootstrap";
import { connect } from "react-redux";

import { installHMMs, fetchHmms } from "../actions";
import { Button, Flex, FlexItem } from "../../base";

class HMMInstall extends React.Component {

    render () {
        if (this.props.process && !this.props.process.error) {

            const progress = this.getProgress(this.props);

            let step = replace(this.props.process.step, "_", " ");

            if (step === "download") {
                const size = this.props.size;
                const part = this.props.size * this.props.process.progress;
                step += ` (${Numeral(part).format("0.0 b")}/${Numeral(size).format("0.0 b")})`;
            }

            return (
                <Panel>
                    <Panel.Body>
                        <Row>
                            <Col xs={10} xsOffset={1} md={6} mdOffset={3}>
                                <div className="text-center">
                                    <p><strong>Installing</strong></p>
                                    <ProgressBar now={progress} />
                                    <p>
                                        <small className="text-muted text-capitalize">
                                            {step}
                                        </small>
                                    </p>
                                </div>
                            </Col>
                        </Row>
                    </Panel.Body>
                </Panel>
            );
        }

        return (
            <Panel>
                <Panel.Body>
                    <Flex justifyContent="center" style={{padding: "10px 0"}}>
                        <FlexItem>
                            <i
                                className="fas fa-info-circle text-primary"
                                style={{fontSize: "40px", padding: "5px 10px 0 5px"}}
                            />
                        </FlexItem>

                        <FlexItem>
                            <p style={{fontSize: "22px", margin: "0 0 3px"}}>
                                No HMM data available.
                            </p>

                            <p className="text-muted">
                                You can download and install the offical HMM data automatically from our
                                <a href="https://github.com/virtool/virtool-hmm"> GitHub repository</a>.
                            </p>

                            <Button icon="download" onClick={this.props.onInstall}>
                                Install Official
                            </Button>
                        </FlexItem>
                    </Flex>
                </Panel.Body>
            </Panel>
        );
    }
}

const mapStateToProps = (state) => {
    const status = state.hmms.status;
    const processId = get(status, "process.id");
    const process = find(state.process, {id: processId});

    return {
        ...status,
        process
    }
};

const mapDispatchToProps = (dispatch) => ({

    onInstall: () => {
        dispatch(installHMMs());
    },

    onRefresh: () => {
        dispatch(fetchHmms());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(HMMInstall);

