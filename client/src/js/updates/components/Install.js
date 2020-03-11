import { forEach, reduce, replace, split, trimEnd } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import Request from "superagent";
import { pushState } from "../../app/actions";
import { Button, Label, Loader, DialogBody, ModalDialog, DialogFooter, ProgressBar } from "../../base";
import { byteSize, routerLocationHasState } from "../../utils/utils";

import { installSoftwareUpdates } from "../actions";
import { ReleaseMarkdown } from "./Markdown";

export const attemptReload = () => {
    Request.get(`${window.location.origin}/api`).end((err, res) => {
        if (!err && res.ok) {
            window.location = window.location.origin;
        }
    });
};

export const mergeBody = releases => {
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
            <DialogBody className="text-center" style={{ padding: "50px 15px" }}>
                <p>Restarting server</p>
                <Loader color="#3c8786" />
            </DialogBody>
        );
    }

    let ratio;

    if (step === "download") {
        ratio = ` (${byteSize(count)} of ${byteSize(size)})`;
    }

    return (
        <DialogBody>
            <ProgressBar color="green" now={progress * 100} />
            <p className="text-center">
                <small>
                    <span className="text-capitalize">{step}</span>
                    {ratio}
                </small>
            </p>
        </DialogBody>
    );
};

export const SoftwareInstall = ({ onHide, onInstall, process, releases, show, updating }) => {
    const mergedBody = mergeBody(releases);

    let content;

    if (process === null) {
        content = (
            <div>
                <DialogBody>
                    <ReleaseMarkdown body={mergedBody} noMargin />
                </DialogBody>

                <DialogFooter>
                    <Button bsStyle="primary" icon="download" onClick={onInstall}>
                        Install
                    </Button>
                </DialogFooter>
            </div>
        );
    } else {
        content = <Process {...process} size={releases[0].size} updating={updating} />;
    }

    const header = (
        <div>
            Software Update <Label>{releases[0].name}</Label>
        </div>
    );

    return (
        <ModalDialog headerText={header} label="updatesInstall" show={show} onHide={onHide}>
            {content}
        </ModalDialog>
    );
};

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "install", true),
    process: state.updates.process,
    releases: state.updates.releases,
    updating: state.updates.updating
});

const mapDispatchToProps = dispatch => ({
    onInstall: () => {
        dispatch(installSoftwareUpdates());
    },

    onHide: () => {
        dispatch(pushState({ install: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SoftwareInstall);
