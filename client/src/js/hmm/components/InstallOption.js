import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Alert, Button } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { installHMMs } from "../actions";

const InstallOptionAlert = styled(Alert)`
    display: block;
    margin: 0;
`;

export const InstallOption = ({ canInstall, onInstall, releaseId }) => {
    if (canInstall) {
        return (
            <Button color="blue" icon="download" onClick={() => onInstall(releaseId)}>
                Install
            </Button>
        );
    }

    return (
        <InstallOptionAlert color="orange">
            <strong>You do not have permission to install HMMs.</strong>
            <span> Contact an administrator.</span>
        </InstallOptionAlert>
    );
};

export const mapStateToProps = state => ({
    canInstall: checkAdminOrPermission(state, "modify_hmm"),
    releaseId: get(state.hmms.status, "release.id")
});

export const mapDispatchToProps = dispatch => ({
    onInstall: releaseId => {
        dispatch(installHMMs(releaseId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(InstallOption);
