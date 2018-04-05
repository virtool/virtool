import React from "react";
import Request from "superagent";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { forEach, reduce, replace, split, trimEnd } from "lodash-es";
import { ClipLoader } from "halogenium";
import { Label, Modal, ProgressBar } from "react-bootstrap";

import { installSoftwareUpdates, hideInstallModal } from "../actions";
import { Button } from "../../base";
import { ReleaseMarkdown } from "./Release";
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

const mergeBody = (releases) => {

    const result = {};

    forEach(releases, release => {
        forEach(split(release.body, "#### "), body => {
            if (body) {
                const header = split(body, "\n", 1);

                if (result[header] === undefined) {
                    result[header] = [];
                }

                result[header].push(replace(trimEnd(body), `${header}\n`, ""));
            }
        });
    });

    return reduce(result, (body, list, header) => `${body}\n\n#### ${header}\n${list.join("")}`, "");
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

    const text = replace(step, "_", " ");

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

        const mergedBody = mergeBody(this.props.releases);

        let content;

        if (this.props.process === null) {
            content = (
                <div>
                    <Modal.Body>
                        <ReleaseMarkdown body={mergedBody} noMargin />
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
                    Software Update <Label>{this.props.releases[0].name}</Label>
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

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareInstallModal);
