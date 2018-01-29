import React from "react";
import Numeral from "numeral";
import { replace } from "lodash-es";
import { Alert, Col, Panel, ProgressBar, Row } from "react-bootstrap";
import { connect } from "react-redux";

import { installHMMs } from "../actions";
import { Button, Icon } from "../../base";

const steps = [
    "check_github",
    "download",
    "decompress",
    "install_profiles",
    "import_annotations"
];

class HMMInstall extends React.Component {

    render () {
        if (this.props.process && !this.props.process.error) {

            const progress = 20 * (steps.indexOf(this.props.process.step) + this.props.process.progress);

            let step = replace(this.props.process.step, "_", " ");

            if (step === "download") {
                const size = this.props.size;
                const part = this.props.size * this.props.process.progress;
                step += ` (${Numeral(part).format("0.0 b")}/${Numeral(size).format("0.0 b")})`;
            }

            return (
                <Panel>
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
                </Panel>
            );
        }

        return (
            <Alert bsStyle="warning" className="text-center">
                <h5 className="text-warning">
                    <strong>
                        <Icon name="warning" /> No HMM file found.
                    </strong>
                </h5>

                <Button icon="download" onClick={this.props.onInstall}>
                    Install Official
                </Button>
            </Alert>
        );
    }
}

const mapStateToProps = (state) => ({
    size: state.hmms.size,
    ready: state.hmms.ready,
    process: state.hmms.process
});

const mapDispatchToProps = (dispatch) => ({

    onInstall: () => {
        dispatch(installHMMs());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMInstall);

export default Container;

