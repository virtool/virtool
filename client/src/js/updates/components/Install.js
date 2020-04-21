import { forEach, reduce, replace, split, trimEnd } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import Request from "superagent";
import { pushState } from "../../app/actions";
import { AffixedProgressBar, Button, DialogBody, DialogFooter, Label, Loader, ModalDialog } from "../../base";
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

const StyledInstallProcess = styled(DialogBody)`
    padding: 50px 15px;
    position: relative;
    text-align: center;

    p {
        font-weight: bold;
    }

    small {
        font-size: ${props => props.theme.fontSize.sm};
        text-transform: capitalize;
    }
`;

export const InstallProcess = ({ count, progress, size, step, updating }) => {
    if (updating && progress === 1 && !window.reloadInterval) {
        window.setTimeout(() => {
            window.reloadInterval = window.setInterval(attemptReload, 1000);
        }, 3000);

        return (
            <StyledInstallProcess>
                <p>Restarting server</p>
                <Loader color="blue" />
            </StyledInstallProcess>
        );
    }

    let ratio;

    if (step === "download") {
        ratio = ` (${byteSize(count)} of ${byteSize(size)})`;
    }

    return (
        <StyledInstallProcess>
            <AffixedProgressBar color="blue" now={progress * 100} />
            <p>Installing Update</p>
            <small>
                <span>{step}</span>
                {ratio}
            </small>
        </StyledInstallProcess>
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
                    <Button color="blue" icon="download" onClick={onInstall}>
                        Install
                    </Button>
                </DialogFooter>
            </div>
        );
    } else {
        content = <InstallProcess {...process} size={releases[0].size} updating={updating} />;
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
