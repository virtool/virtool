/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Label, Modal, ProgressBar } from "react-bootstrap";

import { installSoftwareUpdates, hideInstallModal } from "../actions";
import { Button } from "../../components/Base";
import { renderReleaseMarkdown } from "./Release";
import { byteSize } from "../../utils";

const installSteps = [
    "block_jobs",
    "download",
    "decompress",
    "check_tree",
    "copy_files"
];

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
                        <strong>
                            Update to <Label>{this.props.releases[0].name}</Label>
                        </strong>
                        <strong>Changes</strong>
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
            const process = this.props.process;

            const stepIndex = installSteps.indexOf(process.step);

            const now = (stepIndex + 1) / 5 + (process.progress * 0.2);

            const text = process.step.replace("_", " ");

            let ratio;

            if (process.step === "download") {
                ratio = `ed ${byteSize(process.progress * process.size)} of ${byteSize(process.size)}`;
            }

            content = (
                <Modal.Body>
                    <ProgressBar now={now * 100} />
                    <p className="text-center">
                        <small>
                            <span className="text-capitalize">{text}</span>{ratio}
                        </small>
                    </p>
                </Modal.Body>
            );
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

const mapStateToProps = (state) => {
    return {
        show: state.updates.showInstallModal,
        process: state.updates.software.process
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onInstall: () => {
            dispatch(installSoftwareUpdates());
        },

        onHide: () => {
            dispatch(hideInstallModal());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareInstallModal);

export default Container;
