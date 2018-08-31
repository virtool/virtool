import React from "react";
import Request from "superagent";
import { ClipLoader } from "halogenium";
import { forEach, reduce, replace, split, trimEnd } from "lodash-es";
import { Label, Modal, ProgressBar } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { installSoftwareUpdates } from "../actions";
import { Button } from "../../base";
import { ReleaseMarkdown } from "./Release";
import {byteSize, routerLocationHasState} from "../../utils";

export const attemptReload = () => {
    Request.get(`${window.location.origin}/api`)
        .end((err, res) => {
            if (!err && res.ok) {
                window.location = window.location.origin;
            }
        });
};

export const mergeBody = (releases) => {

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

export const Process = ({ count, progress, size, step, updating }) => {

    if (updating && progress === 1 && !window.reloadInterval) {
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

    let ratio;

    if (step === "download") {
        ratio = ` (${byteSize(count)} of ${byteSize(size)})`;
    }

    return (
        <Modal.Body>
            <ProgressBar now={progress * 100} />
            <p className="text-center">
                <small>
                    <span className="text-capitalize">{step}</span>{ratio}
                </small>
            </p>
        </Modal.Body>
    );
};

export const SoftwareInstall = ({ onHide, onInstall, process, releases, show, updating }) => {

    const mergedBody = mergeBody(releases);

    let content;

    if (process === null) {
        content = (
            <div>
                <Modal.Body>
                    <ReleaseMarkdown body={mergedBody} noMargin />
                </Modal.Body>

                <Modal.Footer>
                    <Button bsStyle="primary" icon="download" onClick={onInstall}>
                        Install
                    </Button>
                </Modal.Footer>
            </div>
        );
    } else {
        content = <Process {...process} size={releases[0].size} updating={updating} />;
    }

    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Header onHide={onHide} closeButton>
                Software Update <Label>{releases[0].name}</Label>
            </Modal.Header>

            {content}
        </Modal>
    );
};

const mapStateToProps = (state) => ({
    show: routerLocationHasState(state, "install", true),
    process: state.updates.process,
    releases: state.updates.releases,
    updating: state.updates.updating
});

const mapDispatchToProps = (dispatch) => ({

    onInstall: () => {
        dispatch(installSoftwareUpdates());
    },

    onHide: () => {
        dispatch(push({state: {install: false}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareInstall);
