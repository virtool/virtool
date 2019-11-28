import { get, replace } from "lodash-es";
import React from "react";
import { ProgressBar } from "react-bootstrap";
import { connect } from "react-redux";

import styled from "styled-components";
import { checkAdminOrPermission } from "../../utils/utils";
import { installHMMs } from "../actions";
import { getProcess } from "../selectors";

import { Box } from "../../base/Box";
import { InstallOption } from "./InstallOption";

const LoadingBar = styled.div`
    width: 50%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: 285px;
`;
const LoadingText = styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: 15px;
    font-weight: bold;
`;

const Icon = styled.div`
    display: flex;
    font-size: 40px;
    margin-left: 95px;
    margin-right: 9px;
`;
const Button = styled.div`
    width: 150px;
`;
const TextButton = styled.div`
    display: flex;
    flex-direction: column;
`;
const IconTextButton = styled.div`
    display: flex;
    align-items: top;
    margin: 15px;
`;

export class HMMInstaller extends React.Component {
    render() {
        if (this.props.process && !this.props.installed) {
            const progress = this.props.process.progress * 100;
            const step = replace(this.props.process.step, "_", " ");

            const barStyle = progress === 100 ? "success" : "warning";

            return (
                <Box>
                    <LoadingBar>
                        <LoadingText>Installing</LoadingText>

                        <ProgressBar bsStyle={barStyle} now={progress} />

                        <LoadingText>
                            <small className="text-muted text-capitalize">{step}</small>
                        </LoadingText>
                    </LoadingBar>
                </Box>
            );
        }

        return (
            <Box>
                <IconTextButton>
                    <Icon>
                        <i className="fas fa-info-circle text-primary" />
                    </Icon>
                    <TextButton>
                        <p style={{ fontSize: "22px", margin: "0 0 3px" }}>No HMM data available.</p>
                        <p className="text-muted">
                            You can download and install the offical HMM data automatically from our
                            <a href="https://github.com/virtool/virtool-hmm"> GitHub repository</a>.
                        </p>
                        <Button>{InstallOption(this.props)}</Button>
                    </TextButton>
                </IconTextButton>
            </Box>
        );
    }
}

export const mapStateToProps = state => ({
    releaseId: get(state.hmms.status, "release.id"),
    installed: !!state.hmms.status.installed,
    canInstall: checkAdminOrPermission(state, "modify_hmm"),
    process: getProcess(state)
});

export const mapDispatchToProps = dispatch => ({
    onInstall: releaseId => {
        dispatch(installHMMs(releaseId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMInstaller);
