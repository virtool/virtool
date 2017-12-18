/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import Request from "superagent";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Label, Modal, ProgressBar } from "react-bootstrap";

import { installSoftwareUpdates, hideInstallModal } from "../actions";
import { Button } from "../../base";
import { renderReleaseMarkdown } from "./Release";
import { byteSize } from "../../utils";

const installSteps = [
    "block_jobs",
    "download",
    "decompress",
    "check_tree",
    "copy_files"
];

const attemptReload = () => {
    Request.get(`${window.location.origin}/api`)
        .end((err, res) => {
            if (!err && res.ok) {
                window.location = window.location.origin;
            }
        });
};

const Process = ({ complete, progress, size, step }) => {

    if (complete && !window.reloadInterval) {
        window.setTimeout(() => {
            window.reloadInterval = window.setInterval(attemptReload, 1000);
        }, 3000);

        return (
            <Modal.Body className="text-center" style={{padding: "50px 15px"}}>
                <p>Restarting server</p>
                <ClipLoader color="#3c8786" />
            </Modal.Body>
        );
    }

    const stepIndex = installSteps.indexOf(step);

    const now = (stepIndex + 1) / 5 + (progress * 0.2);

    const text = step.replace("_", " ");

    let ratio;

    if (step === "download") {
        ratio = `ed ${byteSize(progress * size)} of ${byteSize(size)}`;
    }

    return (
        <Modal.Body>
            <ProgressBar now={now * 100} />
            <p className="text-center">
                <small>
                    <span className="text-capitalize">{text}</span>{ratio}
                </small>
            </p>
        </Modal.Body>
    );
};

class SoftwareInstallModal extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        show: PropTypes.bool,
        process: PropTypes.object,
        releases: PropTypes.arrayOf(PropTypes.object),
        onInstall: PropTypes.func,
        onHide: PropTypes.func
    };

    render () {
        const mergedBody = this.props.releases.map(release => release.body).join("\n");

        let content;

        if (this.props.process === null) {
            content = (
                <div>
                    <Modal.Body>
                        <h5>
                            <strong>
                                Update to <Label>{this.props.releases[0].name}</Label>
                            </strong>
                        </h5>
                        {renderReleaseMarkdown(mergedBody)}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button bsStyle="primary" icon="download" onClick={this.props.onInstall}>
                            Install
                        </Button>
                    </Modal.Footer>
                </div>
            );
        } else {
            content = <Process {...this.props.process} />;
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Software Update
                </Modal.Header>
                {content}
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    show: state.updates.showInstallModal,
    process: state.updates.software.process
});

const mapDispatchToProps = (dispatch) => ({

    onInstall: () => {
        dispatch(installSoftwareUpdates());
    },

    onHide: () => {
        dispatch(hideInstallModal());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareInstallModal);

export default Container;
